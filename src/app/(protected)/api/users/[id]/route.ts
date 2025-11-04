// app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { deleteUser, updateUserRole } from "@/actions/user-actions";
import { verifyAuth } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string | string[] | undefined } | undefined>;
};

const resolveIdParam = (value: string | string[] | undefined): string | null =>
  Array.isArray(value) ? value[0] ?? null : typeof value === "string" ? value : null;

const resolveClientIdentifier = (request: NextRequest): string => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  return "unknown";
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const id = resolveIdParam(params?.id);
    if (!id) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const authResult = await verifyAuth(request);
    if (!authResult.success || authResult.user?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const clientIdentifier = resolveClientIdentifier(request);
    const result = await deleteUser(
      id,
      authResult.user.email,
      {
        requesterId: authResult.user.userId,
        requesterEmail: authResult.user.email,
        requesterIp: clientIdentifier,
      }
    );
    if (!result.success) {
      const status =
        result.error === "RATE_LIMIT_EXCEEDED"
          ? 429
          : result.error === "USER_NOT_FOUND"
          ? 404
          : 400;

      const response = NextResponse.json(
        { error: result.message },
        { status }
      );

      if (status === 429 && result.retryAfterSeconds) {
        response.headers.set("Retry-After", String(result.retryAfterSeconds));
      }

      return response;
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const id = resolveIdParam(params?.id);
    if (!id) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const authResult = await verifyAuth(request);
    if (!authResult.success || authResult.user?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { role } = await request.json();
    const clientIdentifier = resolveClientIdentifier(request);
    const result = await updateUserRole(
      id,
      role,
      authResult.user.email,
      {
        requesterId: authResult.user.userId,
        requesterEmail: authResult.user.email,
        requesterIp: clientIdentifier,
      }
    );

    if (!result.success) {
      const status =
        result.error === "RATE_LIMIT_EXCEEDED"
          ? 429
          : result.error === "USER_NOT_FOUND"
          ? 404
          : 400;

      const response = NextResponse.json(
        { error: result.message },
        { status }
      );

      if (status === 429 && result.retryAfterSeconds) {
        response.headers.set("Retry-After", String(result.retryAfterSeconds));
      }

      return response;
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
