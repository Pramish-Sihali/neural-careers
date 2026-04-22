import { SignJWT, jwtVerify } from "jose";

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!);

export type OfferAction = "view-offer" | "sign-offer";

export async function signOfferToken(
  offerId: string,
  action: OfferAction
): Promise<string> {
  return new SignJWT({ action })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(offerId)
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifyOfferToken(
  token: string,
  expectedAction: OfferAction
): Promise<string> {
  const { payload } = await jwtVerify(token, secret());
  if (payload.action !== expectedAction) throw new Error("Invalid token action");
  if (!payload.sub) throw new Error("Missing subject");
  return payload.sub;
}
