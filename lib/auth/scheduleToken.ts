import { SignJWT, jwtVerify } from "jose";

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!);

export async function signScheduleToken(applicationId: string): Promise<string> {
  return new SignJWT({ action: "schedule" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(applicationId)
    .setExpirationTime("48h")
    .sign(secret());
}

export async function verifyScheduleToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret());
  if (payload.action !== "schedule") throw new Error("Invalid token action");
  if (!payload.sub) throw new Error("Missing subject");
  return payload.sub;
}
