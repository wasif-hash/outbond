// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { deleteUser, updateUserRole } from "@/actions/user-actions";
import { verifyAuth } from "@/lib/auth";

interface RouteParams {
  params: { id: string };
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || authResult.user?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const result = await deleteUser(params.id, authResult.user.email);
    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: result.error === "USER_NOT_FOUND" ? 404 : 400 }
      );
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    console.error("Delete user API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || authResult.user?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { role } = await request.json();
    const result = await updateUserRole(params.id, role, authResult.user.email);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: result.error === "USER_NOT_FOUND" ? 404 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      user: result.user,
    });
  } catch (error) {
    console.error("Update user role API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
