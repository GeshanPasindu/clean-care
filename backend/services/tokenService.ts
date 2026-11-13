export const getAccessTokenSecret = () => {
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ACCESS_TOKEN_SECRET (or legacy SECRET) must contain at least 32 characters");
  }
  return secret;
};
