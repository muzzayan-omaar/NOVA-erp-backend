import prisma from "../lib/prisma.js";
import bcrypt from "bcryptjs";
import { assertUserCapacity } from "../utils/checkCapacityLimits.js";
import { generateUniqueStaffId } from "../utils/generateStaffId.js";
import { generateTempPassword } from "../utils/generateTempPassword.js";
import createAuditLog from "../services/auditService.js";

export const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { companyId: req.context.companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        storeId: true,
        activeStoreId: true,
        isActive: true,
        store: { select: { id: true, name: true } },
        createdAt: true,
        employeeProfile: {
          select: {
            staffId: true,
            position: true,
            shift: true,
            photoUrl: true,
            hireDate: true,
          },
        },
      },
    });

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

export const getUserDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.context;

    const user = await prisma.user.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        storeId: true,
        isActive: true,
        createdAt: true,
        store: { select: { id: true, name: true, storeCode: true } },
        employeeProfile: true,
      },
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const companyId = req.context.companyId;

    const capacity = await assertUserCapacity(companyId);
    if (!capacity.ok) {
      return res.status(400).json({ message: capacity.message });
    }

    const {
      name,
      email,
      role,
      storeId,
      dateOfBirth,
      gender,
      nationalIdType,
      nationalIdNumber,
      educationLevel,
      position,
      shift,
      photoUrl,
      emergencyContactName,
      emergencyContactPhone,
      hireDate,
      defaultBasicSalary,
    } = req.body;

    if (!name || !role || !storeId) {
      return res.status(400).json({ message: "Name, role, and store are required" });
    }

    if (email) {
      const existing = await prisma.user.findUnique({
        where: { companyId_email: { companyId, email } },
      });
      if (existing) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }
    }

    const store = await prisma.store.findFirst({ where: { id: storeId, companyId } });
    if (!store) return res.status(404).json({ message: "Store not found" });

    const staffId = await generateUniqueStaffId(prisma);
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          companyId,
          name,
          email: email || null,
          passwordHash,
          role,
          storeId,
          activeStoreId: storeId,
          mustChangePassword: true,
        },
      });

      await tx.employeeProfile.create({
        data: {
          userId: newUser.id,
          staffId,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          gender,
          nationalIdType,
          nationalIdNumber,
          educationLevel,
          position,
          shift,
          photoUrl,
          emergencyContactName,
          emergencyContactPhone,
          hireDate: hireDate ? new Date(hireDate) : null,
          defaultBasicSalary: defaultBasicSalary ? Number(defaultBasicSalary) : null,
        },
      });

      return newUser;
    });

    await createAuditLog({
      userId: req.context.userId,
      companyId,
      storeId,
      action: "STAFF_CREATED",
      entityType: "user",
      entityId: user.id,
      metadata: { name, role, position },
    });

    res.status(201).json({
      message: "Staff member created",
      staffId,
      tempPassword,
      storeCode: store.storeCode,
      name: user.name,
      role: user.role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create user" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.context;

    const {
      name,
      email,
      role,
      isActive,
      dateOfBirth,
      gender,
      nationalIdType,
      nationalIdNumber,
      educationLevel,
      position,
      shift,
      photoUrl,
      emergencyContactName,
      emergencyContactPhone,
      hireDate,
      defaultBasicSalary,
    } = req.body;

    const existing = await prisma.user.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ message: "User not found" });

    const updated = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(email !== undefined && { email: email || null }),
          ...(role !== undefined && { role }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      const hasProfileFields = [
        dateOfBirth, gender, nationalIdType, nationalIdNumber, educationLevel,
        position, shift, photoUrl, emergencyContactName, emergencyContactPhone,
        hireDate, defaultBasicSalary,
      ].some((v) => v !== undefined);

      if (hasProfileFields) {
        await tx.employeeProfile.upsert({
          where: { userId: id },
          update: {
            ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
            ...(gender !== undefined && { gender }),
            ...(nationalIdType !== undefined && { nationalIdType }),
            ...(nationalIdNumber !== undefined && { nationalIdNumber }),
            ...(educationLevel !== undefined && { educationLevel }),
            ...(position !== undefined && { position }),
            ...(shift !== undefined && { shift }),
            ...(photoUrl !== undefined && { photoUrl }),
            ...(emergencyContactName !== undefined && { emergencyContactName }),
            ...(emergencyContactPhone !== undefined && { emergencyContactPhone }),
            ...(hireDate !== undefined && { hireDate: hireDate ? new Date(hireDate) : null }),
            ...(defaultBasicSalary !== undefined && { defaultBasicSalary: defaultBasicSalary ? Number(defaultBasicSalary) : null }),
          },
          create: {
            userId: id,
            staffId: await generateUniqueStaffId(tx),
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            gender, nationalIdType, nationalIdNumber, educationLevel,
            position, shift, photoUrl, emergencyContactName, emergencyContactPhone,
            hireDate: hireDate ? new Date(hireDate) : null,
            defaultBasicSalary: defaultBasicSalary ? Number(defaultBasicSalary) : null,
          },
        });
      }

      return updatedUser;
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.context;

    const existing = await prisma.user.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ message: "User not found" });

    await prisma.user.delete({ where: { id } });
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};