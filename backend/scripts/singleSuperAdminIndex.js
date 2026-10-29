import User from "../models/userModel.js";

export async function ensureSingleSuperAdminIndex() {
  const count = await User.countDocuments({ role: "superAdmin" });
  if (count > 1) {
    throw new Error(`Found ${count} superAdmin accounts. Resolve the duplicates before enabling the single-account constraint.`);
  }

  return User.collection.createIndex(
    { role: 1 },
    {
      name: "single_superadmin_account",
      unique: true,
      partialFilterExpression: { role: "superAdmin" },
    }
  );
}
