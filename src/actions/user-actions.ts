
// actions/user-actions.ts
"use server"

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

// Types for better type safety
export interface CreateUserData {
  email: string
  password: string
  role: 'admin' | 'user' 
}

export interface UserResponse {
  success: boolean
  message: string
  user?: {
    id: string
    email: string
    role: string
    isInvited: boolean
    invitedAt: Date | null
    createdAt: Date
  }
  error?: string
}

export interface UsersListResponse {
  success: boolean
  users?: Array<{
    id: string
    email: string
    role: string
    isInvited: boolean
    invitedAt: Date | null
    createdAt: Date
  }>
  error?: string
}

/**
 * Create a new user with hashed password
 * This is the main function for inviting users
 */
export async function createInvitedUser(data: CreateUserData): Promise<UserResponse> {
  try {
    const { email, password, role } = data

    // Validate input data
    if (!email || !password || !role) {
      return {
        success: false,
        message: 'All fields are required',
        error: 'MISSING_FIELDS'
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return {
        success: false,
        message: 'Invalid email format',
        error: 'INVALID_EMAIL'
      }
    }

    // Validate password strength
    if (password.length < 8) {
      return {
        success: false,
        message: 'Password must be at least 8 characters long',
        error: 'WEAK_PASSWORD'
      }
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (existingUser) {
      return {
        success: false,
        message: 'User with this email already exists',
        error: 'USER_EXISTS'
      }
    }

    // Hash the password
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Create the user
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        isInvited: true,
        invitedAt: new Date()
      }
    })

    // Revalidate the users list page
    revalidatePath('/dashboard/users')

    return {
      success: true,
      message: 'User invited successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        isInvited: newUser.isInvited,
        invitedAt: newUser.invitedAt,
        createdAt: newUser.createdAt
      }
    }

  } catch (error) {
    console.error('Error creating user:', error)
    return {
      success: false,
      message: 'Failed to create user. Please try again.',
      error: 'DATABASE_ERROR'
    }
  }
}

/**
 * Get all users from the database
 * Used to display the users list
 */
export async function getAllUsers(): Promise<UsersListResponse> {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isInvited: true,
        invitedAt: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return {
      success: true,
      users
    }

  } catch (error) {
    console.error('Error fetching users:', error)
    return {
      success: false,
      error: 'DATABASE_ERROR'
    }
  }
}

/**
 * Delete a user by ID
 * Includes safety checks to prevent self-deletion and admin protection
 */
export async function deleteUser(userId: string, currentUserEmail: string): Promise<UserResponse> {
  try {
    if (!userId) {
      return {
        success: false,
        message: 'User ID is required',
        error: 'MISSING_ID'
      }
    }

    // Get the user to be deleted
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!userToDelete) {
      return {
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      }
    }

    // Prevent self-deletion
    if (userToDelete.email === currentUserEmail) {
      return {
        success: false,
        message: 'You cannot delete your own account',
        error: 'SELF_DELETE_FORBIDDEN'
      }
    }

    // Prevent deletion of the main admin
    if (userToDelete.email === 'shanon@creatorwealthtools.com') {
      return {
        success: false,
        message: 'Cannot delete the main admin account',
        error: 'MAIN_ADMIN_DELETE_FORBIDDEN'
      }
    }

    // Delete the user
    await prisma.user.delete({
      where: { id: userId }
    })

    // Revalidate the users list page
    revalidatePath('/dashboard/users')

    return {
      success: true,
      message: 'User deleted successfully'
    }

  } catch (error) {
    console.error('Error deleting user:', error)
    return {
      success: false,
      message: 'Failed to delete user. Please try again.',
      error: 'DATABASE_ERROR'
    }
  }
}

/**
 * Update user role
 * Includes safety checks to prevent role changes to main admin
 */
export async function updateUserRole(
  userId: string, 
  newRole: 'admin' | 'user' | 'moderator',
  currentUserEmail: string
): Promise<UserResponse> {
  try {
    if (!userId || !newRole) {
      return {
        success: false,
        message: 'User ID and role are required',
        error: 'MISSING_FIELDS'
      }
    }

    // Get the user to be updated
    const userToUpdate = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!userToUpdate) {
      return {
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      }
    }

    // Prevent changing own role
    if (userToUpdate.email === currentUserEmail) {
      return {
        success: false,
        message: 'You cannot change your own role',
        error: 'SELF_ROLE_CHANGE_FORBIDDEN'
      }
    }

    // Prevent changing the main admin's role
    if (userToUpdate.email === 'shanon@creatorwealthtools.com') {
      return {
        success: false,
        message: 'Cannot change the main admin\'s role',
        error: 'MAIN_ADMIN_ROLE_CHANGE_FORBIDDEN'
      }
    }

    // Update the user role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        role: newRole,
        updatedAt: new Date()
      }
    })

    // Revalidate the users list page
    revalidatePath('/dashboard/users')

    return {
      success: true,
      message: 'User role updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        isInvited: updatedUser.isInvited,
        invitedAt: updatedUser.invitedAt,
        createdAt: updatedUser.createdAt
      }
    }

  } catch (error) {
    console.error('Error updating user role:', error)
    return {
      success: false,
      message: 'Failed to update user role. Please try again.',
      error: 'DATABASE_ERROR'
    }
  }
}

/**
 * Authenticate user for login
 * This is used by the login API route
 */
export async function authenticateUser(email: string, password: string): Promise<{
  success: boolean
  user?: {
    id: string
    email: string
    role: string
  }
  message: string
}> {
  try {
    if (!email || !password) {
      return {
        success: false,
        message: 'Email and password are required'
      }
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (!user) {
      return {
        success: false,
        message: 'Invalid email or password'
      }
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return {
        success: false,
        message: 'Invalid email or password'
      }
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      message: 'Authentication successful'
    }

  } catch (error) {
    console.error('Error authenticating user:', error)
    return {
      success: false,
      message: 'Authentication failed. Please try again.'
    }
  }
}

/**
 * Initialize the main admin user
 * This should be run once to create the main admin
 */
export async function initializeMainAdmin(): Promise<UserResponse> {
  try {
    const adminEmail = 'shannon@creatorwealthtools.com'
    
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    })

    if (existingAdmin) {
      return {
        success: true,
        message: 'Main admin already exists'
      }
    }

    // Create a secure default password (should be changed after first login)
    const defaultPassword = 'CWTAdmin2024!'
    const hashedPassword = await bcrypt.hash(defaultPassword, 12)

    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        isInvited: false // Main admin is not "invited"
      }
    })

    return {
      success: true,
      message: `Main admin created successfully. Default password: ${defaultPassword}`,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        isInvited: adminUser.isInvited,
        invitedAt: adminUser.invitedAt,
        createdAt: adminUser.createdAt
      }
    }

  } catch (error) {
    console.error('Error creating main admin:', error)
    return {
      success: false,
      message: 'Failed to create main admin',
      error: 'DATABASE_ERROR'
    }
  }
}