import prisma from '../../../utils/db.mjs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Faculty login controller
export const loginFaculty = async (req, res, next) => {
    try {
        const { email, password, rememberMe } = req.body;

        // Find faculty member by email
        const user = await prisma.user.findUnique({
            where: { email },
            
        });

        if (!user) {
            const error = new Error('Faculty member not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if user has correct role
        if (user.role !== 'SCHOOL_ADMIN' && user.role !== 'FACULTY') {
            const error = new Error('Unauthorized access - must be School Admin or Faculty');
            error.statusCode = 403;
            throw error;
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            const error = new Error('Invalid password');
            error.statusCode = 401;
            throw error;
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                designation: user.designation
            },
            process.env.AUTH_SECRET,
            { expiresIn: rememberMe ? '30d' : '24h' }
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
                updatedAt: user.updatedAt
            }
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Get faculty profile controller
export const getFacultyProfile = async (req, res, next) => {
    try {
        const facultyId = req.user.userId;

        const faculty = await prisma.faculty.findUnique({
            where: { id: facultyId },
            include: {
                department: {
                    include: {
                        school: true
                    }
                }
            }
        });

        if (!faculty) {
            const error = new Error('Faculty member not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            faculty: {
                id: faculty.id,
                name: faculty.name,
                email: faculty.email,
                role: faculty.role,
                department: faculty.department,
                createdAt: faculty.createdAt,
                updatedAt: faculty.updatedAt
            }
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Update faculty password controller
export const updateFacultyPassword = async (req, res, next) => {
    try {
        const facultyId = req.user.userId;
        const { currentPassword, newPassword } = req.body;

        // Find faculty member
        const faculty = await prisma.faculty.findUnique({
            where: { id: facultyId }
        });

        if (!faculty) {
            const error = new Error('Faculty member not found');
            error.statusCode = 404;
            throw error;
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, faculty.password);
        if (!isValidPassword) {
            const error = new Error('Current password is incorrect');
            error.statusCode = 401;
            throw error;
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        await prisma.faculty.update({
            where: { id: facultyId },
            data: { password: hashedPassword }
        });

        res.status(200).json({
            message: 'Password updated successfully'
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};
