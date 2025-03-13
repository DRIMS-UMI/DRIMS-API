import bcrypt from 'bcrypt';
import prisma from '../../../utils/db.mjs';
import jwt from 'jsonwebtoken';

// Controller for registering a SuperAdmin
export const registerSuperAdmin = async (req, res, next) => {
    try {
        // Check if a SuperAdmin already exists
        const existingSuperAdmin = await prisma.user.findFirst({
            where: { role: 'SUPERADMIN' }
        });

        if (existingSuperAdmin) {
            const error = new Error('SuperAdmin already exists.');
            error.statusCode = 403;
            throw error;
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(req.body.password, 10);

        // Create new SuperAdmin
        const superAdmin = await prisma.user.create({
            data: {
                name: req.body.name,
                title: req.body.title,
                email: req.body.email,
                phone: req.body.phone,
                designation: req.body.designation,
                password: hashedPassword,
                role: 'SUPERADMIN'
            }
        });

        res.status(201).json({ message: 'SuperAdmin registered successfully.', superAdmin });
    } catch (error) {
        if(!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for logging in a SuperAdmin
export const loginSuperAdmin = async (req, res, next) => {
    try {
        const { email, password, rememberMe } = req.body;

        // Find the SuperAdmin by email
        const superAdmin = await prisma.user.findFirst({
            where: {
                email,
                role: 'SUPERADMIN'
            }
        });

        if (!superAdmin) {
            const error = new Error('Invalid email or password');
            error.statusCode = 403;
            throw error;
        }

        // Compare passwords
        const isValidPassword = await bcrypt.compare(password, superAdmin.password);

        if (!isValidPassword) {
            const error = new Error('Invalid email or password');
            error.statusCode = 403;
            throw error;
        }

        // Create JWT token
        const userData = {
            id: superAdmin.id,
            email: superAdmin.email,
            name: superAdmin.name,
            role: superAdmin.role,
            designation: superAdmin.designation
        };

        const token = jwt.sign(
            userData,
            process.env.AUTH_SECRET,
            { expiresIn: rememberMe ? '30d' : '24h' }
        );

        res.status(200).json({
            message: 'Login successful',
            user: userData,
            token
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for logging in a Research Centre Admin
export const loginResearchCentreAdmin = async (req, res, next) => {
    try {
        const { email, password, rememberMe } = req.body;

        // Find the Research Centre Admin by email
        const researchAdmin = await prisma.user.findFirst({
            where: {
                email,
                role: 'RESEARCH_ADMIN'
            }
        });

        if (!researchAdmin) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Compare passwords
        const isValidPassword = await bcrypt.compare(password, researchAdmin.password);

        if (!isValidPassword) {
            const error = new Error('Invalid email or password');
            error.statusCode = 403;
            throw error;
        }

            // Create session or token here if needed
        // For now just sending back basic user info
        const userData = {
            id: researchAdmin.id,
            email: researchAdmin.email,
            name: researchAdmin.name,
            role: researchAdmin.role,
            designation: researchAdmin.designation
        };

        const token = jwt.sign(
            userData,
            process.env.AUTH_SECRET,
            { expiresIn: rememberMe ? '30d' : '24h' }
        );

        res.status(200).json({
            message: 'Login successful',
            user: userData,
            token
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for getting logged in user details
export const getLoggedInUserDetails = async (req, res, next) => {
    try {
        
        const user = req.user;

        console.log(user);
        res.status(200).json({
            message: 'User details fetched successfully',
            user
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


// Controller for accessing the management portal
export const accessManagementPortal = (req, res) => {
    res.send('Welcome to the Management Portal');
}; 