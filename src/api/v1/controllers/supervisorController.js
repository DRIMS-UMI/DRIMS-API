import prisma from "../../../utils/db.mjs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import crypto from "crypto";

import { notificationService } from "../../../services/notificationService.js";

//Supervisor login Controller
export const loginSupervisor = async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Find supervisor by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      const error = new Error("Faculty member not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if user is active
    if (!user.isActive) {
      const error = new Error(
        "Your account has been deactivated. Please contact the administrator."
      );
      error.statusCode = 403;
      throw error;
    }

    // Check if user has correct role
    if (user.role !== "SCHOOL_ADMIN" && user.role !== "FACULTY") {
      const error = new Error(
        "Unauthorized access - must be School Admin or Faculty"
      );
      error.statusCode = 403;
      throw error;
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      const error = new Error("Invalid password");
      error.statusCode = 401;
      throw error;
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        title: user.title,
        email: user.email,
        name: user.name,
        role: user.role,
        designation: user.designation,
        loggedInAt: new Date(),
        phone: user.phone,
      },
      process.env.AUTH_SECRET,
      { expiresIn: rememberMe ? "30d" : "24h" }
    );

    // Return user data and token
    res.status(200).json({
      token,
      faculty: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};


// Get faculty profile controller
export const getSupervisorProfile = async (req, res, next) => {
    try {
      const supervisorId = req.user.id;
  
      const supervisor = req.user;
  
      if (!supervisor) {
        const error = new Error("Supervisor not found");
        error.statusCode = 404;
        throw error;
      }
  
      res.status(200).json({
        supervisor: {
          id: supervisor.id,
          name: supervisor.name,
          email: supervisor.email,
          role: supervisor.role,
          title: supervisor.title,
          phone: supervisor.phone,
          designation: supervisor.designation,
          loggedInAt: supervisor.loggedInAt,
          department: supervisor.department,
          createdAt: supervisor.createdAt,
          updatedAt: supervisor.updatedAt,
        },
      });
    } catch (error) {
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      next(error);
    }
  };