
// actions/user-actions.ts
"use server"

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import {
  createAccountActionRateLimit,
  createAdminActionRateLimit,
  createLoginRateLimit
} from '@/lib/rate-limit'

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
  retryAfterSeconds?: number
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

export interface ActionRequestContext {
  requesterId?: string
  requesterEmail?: string
  requesterIp?: string
}

export interface AuthResponse {
  success: boolean
  user?: {
    id: string
    email: string
    role: string
  }
  message: string
  error?: string
  retryAfterSeconds?: number
}

const MAIN_ADMIN_EMAIL = 'shannon@creatorwealthtools.com' as const
const DEFAULT_ADMIN_PASSWORD = 'CWTAdmin2024!' as const
const RATE_LIMIT_ERROR = 'RATE_LIMIT_EXCEEDED'
const RATE_LIMIT_MESSAGE = 'Too many attempts. Please try again later.'

type RateLimitOutcome = {
  allowed: boolean
  retryAfterSeconds?: number
}

const computeRetryAfterSeconds = (resetTime: number): number =>
  Math.max(1, Math.ceil((resetTime - Date.now()) / 1000))

const buildRateLimitKey = (
  context: ActionRequestContext,
  fallbackKey: string
): string =>
  context.requesterId ??
  context.requesterEmail ??
  context.requesterIp ??
  fallbackKey

async function enforceAdminRateLimit(
  context: ActionRequestContext,
  tokens: number = 1
): Promise<RateLimitOutcome> {
  try {
    const limiter = createAdminActionRateLimit(
      buildRateLimitKey(context, 'admin-global')
    )
    const result = await limiter.checkAndConsume(tokens)

    if (!result.allowed) {
      return {
        allowed: false,
        retryAfterSeconds: computeRetryAfterSeconds(result.resetTime)
      }
    }
  } catch (error) {
    console.error('Admin action rate limit check failed:', error)
  }

  return { allowed: true }
}

async function enforceLoginRateLimit(
  context: ActionRequestContext,
  fallbackKey: string
): Promise<RateLimitOutcome> {
  try {
    const limiter = createLoginRateLimit(
      buildRateLimitKey(context, fallbackKey)
    )
    const result = await limiter.checkAndConsume()

    if (!result.allowed) {
      return {
        allowed: false,
        retryAfterSeconds: computeRetryAfterSeconds(result.resetTime)
      }
    }
  } catch (error) {
    console.error('Login rate limit check failed:', error)
  }

  return { allowed: true }
}

async function enforceAccountRateLimit(
  context: ActionRequestContext,
  fallbackKey: string
): Promise<RateLimitOutcome> {
  try {
    const limiter = createAccountActionRateLimit(
      buildRateLimitKey(context, fallbackKey)
    )
    const result = await limiter.checkAndConsume()

    if (!result.allowed) {
      return {
        allowed: false,
        retryAfterSeconds: computeRetryAfterSeconds(result.resetTime)
      }
    }
  } catch (error) {
    console.error('Account action rate limit check failed:', error)
  }

  return { allowed: true }
}

/**
 * Create a new user with hashed password
 * This is the main function for inviting users
 */
export async function createInvitedUser(
  data: CreateUserData,
  context: ActionRequestContext = {}
): Promise<UserResponse> {
  try {
    const { email, password, role } = data

    const rateLimit = await enforceAdminRateLimit(context)
    if (!rateLimit.allowed) {
      return {
        success: false,
        message: RATE_LIMIT_MESSAGE,
        error: RATE_LIMIT_ERROR,
        retryAfterSeconds: rateLimit.retryAfterSeconds
      }
    }

    // Validate input data
    if (!email || !password || !role) {
      return {
        success: false,
        message: 'All fields are required',
        error: 'MISSING_FIELDS'
      }
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
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
      where: { email: normalizedEmail }
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
        email: normalizedEmail,
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
export async function deleteUser(
  userId: string,
  currentUserEmail: string,
  context: ActionRequestContext = {}
): Promise<UserResponse> {
  try {
    const rateLimit = await enforceAdminRateLimit({
      requesterId: context.requesterId,
      requesterEmail: context.requesterEmail ?? currentUserEmail,
      requesterIp: context.requesterIp
    })

    if (!rateLimit.allowed) {
      return {
        success: false,
        message: RATE_LIMIT_MESSAGE,
        error: RATE_LIMIT_ERROR,
        retryAfterSeconds: rateLimit.retryAfterSeconds
      }
    }

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
    if (userToDelete.email === MAIN_ADMIN_EMAIL) {
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
  currentUserEmail: string,
  context: ActionRequestContext = {}
): Promise<UserResponse> {
  try {
    const rateLimit = await enforceAdminRateLimit({
      requesterId: context.requesterId,
      requesterEmail: context.requesterEmail ?? currentUserEmail,
      requesterIp: context.requesterIp
    })

    if (!rateLimit.allowed) {
      return {
        success: false,
        message: RATE_LIMIT_MESSAGE,
        error: RATE_LIMIT_ERROR,
        retryAfterSeconds: rateLimit.retryAfterSeconds
      }
    }

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
    if (userToUpdate.email === MAIN_ADMIN_EMAIL) {
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
 * Update password for the current user
 */
export async function updateCurrentUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  context: ActionRequestContext = {}
): Promise<UserResponse> {
  try {
    if (!userId || !currentPassword || !newPassword) {
      return {
        success: false,
        message: 'All password fields are required',
        error: 'MISSING_FIELDS'
      }
    }

    if (newPassword.length < 8) {
      return {
        success: false,
        message: 'New password must be at least 8 characters long',
        error: 'WEAK_PASSWORD'
      }
    }

    const rateLimit = await enforceAccountRateLimit(
      {
        requesterId: context.requesterId ?? userId,
        requesterEmail: context.requesterEmail,
        requesterIp: context.requesterIp
      },
      userId
    )

    if (!rateLimit.allowed) {
      return {
        success: false,
        message: RATE_LIMIT_MESSAGE,
        error: RATE_LIMIT_ERROR,
        retryAfterSeconds: rateLimit.retryAfterSeconds
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return {
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      }
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)

    if (!isCurrentPasswordValid) {
      return {
        success: false,
        message: 'The current password is incorrect',
        error: 'INVALID_CREDENTIALS'
      }
    }

    if (currentPassword === newPassword) {
      return {
        success: false,
        message: 'New password must be different from the current password',
        error: 'NO_PASSWORD_CHANGE'
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        updatedAt: new Date()
      }
    })

    return {
      success: true,
      message: 'Password updated successfully'
    }
  } catch (error) {
    console.error('Error updating user password:', error)
    return {
      success: false,
      message: 'Failed to update password. Please try again.',
      error: 'DATABASE_ERROR'
    }
  }
}

/**
 * Authenticate user for login
 * This is used by the login API route
 */
export async function authenticateUser(
  email: string,
  password: string,
  context: ActionRequestContext = {}
): Promise<AuthResponse> {
  try {
    if (!email || !password) {
      return {
        success: false,
        message: 'Email and password are required',
        error: 'MISSING_FIELDS'
      }
    }

    const normalizedEmail = email.trim().toLowerCase()
    const rateLimit = await enforceLoginRateLimit(
      {
        requesterId: context.requesterId,
        requesterEmail: context.requesterEmail ?? normalizedEmail,
        requesterIp: context.requesterIp
      },
      normalizedEmail || 'anonymous-login'
    )

    if (!rateLimit.allowed) {
      return {
        success: false,
        message: RATE_LIMIT_MESSAGE,
        error: RATE_LIMIT_ERROR,
        retryAfterSeconds: rateLimit.retryAfterSeconds
      }
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })

    if (!user) {
      return {
        success: false,
        message: 'Invalid email or password',
        error: 'INVALID_CREDENTIALS'
      }
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return {
        success: false,
        message: 'Invalid email or password',
        error: 'INVALID_CREDENTIALS'
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
      message: 'Authentication failed. Please try again.',
      error: 'AUTHENTICATION_ERROR'
    }
  }
}

/**
 * Initialize the main admin user
 * This should be run once to create the main admin
 */
export async function initializeMainAdmin(
  context: ActionRequestContext = {}
): Promise<UserResponse> {
  try {
    const rateLimit = await enforceAdminRateLimit(context)

    if (!rateLimit.allowed) {
      return {
        success: false,
        message: RATE_LIMIT_MESSAGE,
        error: RATE_LIMIT_ERROR,
        retryAfterSeconds: rateLimit.retryAfterSeconds
      }
    }
    
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: MAIN_ADMIN_EMAIL }
    })

    if (existingAdmin) {
      return {
        success: true,
        message: 'Main admin already exists'
      }
    }

    const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12)

    const adminUser = await prisma.user.create({
      data: {
        email: MAIN_ADMIN_EMAIL,
        password: hashedPassword,
        role: 'admin',
        isInvited: false // Main admin is not "invited"
      }
    })

    return {
      success: true,
      message: `Main admin created successfully. Default password: ${DEFAULT_ADMIN_PASSWORD}`,
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
