import { describe, expect, it } from "vitest";
import { canManageRoles, isOwner, isRole, isStaff } from "./roles";

describe("isRole", () => {
  it("accepts the three known roles", () => {
    expect(isRole("owner")).toBe(true);
    expect(isRole("admin")).toBe(true);
    expect(isRole("student")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isRole("superadmin")).toBe(false);
    expect(isRole("")).toBe(false);
  });
});

describe("isStaff", () => {
  it("is true for owner and admin", () => {
    expect(isStaff("owner")).toBe(true);
    expect(isStaff("admin")).toBe(true);
  });

  it("is false for student and unknown values", () => {
    expect(isStaff("student")).toBe(false);
    expect(isStaff("nonsense")).toBe(false);
  });
});

describe("isOwner", () => {
  it("is true only for owner", () => {
    expect(isOwner("owner")).toBe(true);
    expect(isOwner("admin")).toBe(false);
    expect(isOwner("student")).toBe(false);
  });
});

describe("canManageRoles", () => {
  it("only owners can manage roles", () => {
    expect(canManageRoles("owner")).toBe(true);
    expect(canManageRoles("admin")).toBe(false);
    expect(canManageRoles("student")).toBe(false);
  });
});
