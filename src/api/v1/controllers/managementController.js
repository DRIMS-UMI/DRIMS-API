import bcrypt from 'bcrypt';
import prisma from '../../../utils/db.mjs';


// Controller for registering a SuperAdmin
export const registerSuperAdmin = async (req, res) => {
    try {
        // Check if a SuperAdmin already exists
        const existingSuperAdmin = await prisma.user.findFirst({
            where: { role: 'SUPERADMIN' }
        });

        if (existingSuperAdmin) {
            return res.status(403).json({ message: 'SuperAdmin already exists.' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(req.body.password, 10);

        // Create new SuperAdmin
        const superAdmin = await prisma.user.create({
            data: {
                name: req.body.name,
                email: req.body.email,
                phone: req.body.phone,
                designation: req.body.designation,
                password: hashedPassword,
                role: 'SUPERADMIN'
            }
        });

        res.status(201).json({ message: 'SuperAdmin registered successfully.', superAdmin });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error.', error });
    }
};

// Controller for accessing the management portal
export const accessManagementPortal = (req, res) => {
    res.send('Welcome to the Management Portal');
}; 