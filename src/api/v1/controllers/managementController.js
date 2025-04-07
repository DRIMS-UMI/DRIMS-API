import bcrypt from 'bcryptjs';
import prisma from '../../../utils/db.mjs';
import jwt from 'jsonwebtoken';
import { notificationService } from '../../../services/notificationService.js';

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
                role: 'SUPERADMIN',
                isActive: true // Set active by default
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

        // Check if user is active
        if (!superAdmin.isActive) {
            const error = new Error('Your account has been deactivated. Please contact the administrator.');
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
            title: superAdmin.title,
            email: superAdmin.email,
            name: superAdmin.name,
            role: superAdmin.role,
            phone: superAdmin.phone,
            designation: superAdmin.designation,
            loggedInAt: new Date(),
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

        // Check if user is active
        if (!researchAdmin.isActive) {
            const error = new Error('Your account has been deactivated. Please contact the administrator.');
            error.statusCode = 403;
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
            title: researchAdmin.title,
            email: researchAdmin.email,
            name: researchAdmin.name,
            role: researchAdmin.role,
            phone: researchAdmin.phone,
            designation: researchAdmin.designation,
            loggedInAt: new Date(),
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

// Controller for updating logged in user details
export const updateLoggedInUser = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { title, name, phone, designation } = req.body;

        // Check if email is already taken by another user
        // if (email) {
        //     const existingUser = await prisma.user.findFirst({
        //         where: {
        //             email,
        //             id: {
        //                 not: userId
        //             }
        //         }
        //     });

        //     if (existingUser) {
        //         const error = new Error('Email is already in use by another account');
        //         error.statusCode = 400;
        //         throw error;
        //     }
        // }

        // Update user details
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                title,
                name,
            
                phone,
                designation
            }
        });

        // Create user data object to return (excluding sensitive info)
        const userData = {
            id: updatedUser.id,
            title: updatedUser.title,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            designation: updatedUser.designation,
            phone: updatedUser.phone
        };

        res.status(200).json({
            message: 'User details updated successfully',
            user: userData
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for updating logged in user details
export const updateUserProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { title, name, phone, designation } = req.body;

        // Update user profile
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                title,
                name,
                phone,
                designation
            }
        });

        // Create user data object to return (excluding sensitive info)
        const userData = {
            id: updatedUser.id,
            title: updatedUser.title,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            designation: updatedUser.designation,
            phone: updatedUser.phone
        };

        res.status(200).json({
            message: 'Profile updated successfully',
            user: userData
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};



// Controller for changing user password
export const changePassword = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        // Find the user
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            const error = new Error('Current password is incorrect');
            error.statusCode = 403;
            throw error;
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update the password
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        res.status(200).json({
            message: 'Password changed successfully'
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


// Controller for creating a new campus - working
export const createCampus = async (req, res, next) => {
    try {
        const { name, location } = req.body;

        // Check if campus with same name and location already exists
        const existingCampus = await prisma.campus.findFirst({
            where: {
                AND: [
                    { name },
                    { location }
                ]
            }
        });

        if (existingCampus) {
            const error = new Error('Campus with this name and location already exists');
            error.statusCode = 400;
            throw error;
        }

        // Create new campus
        const campus = await prisma.campus.create({
            data: {
                name,
                location
            }
        });

        res.status(201).json({
            message: 'Campus created successfully',
            campus
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for getting all campuses - working
export const getAllCampuses = async (req, res, next) => {
    try {
        const campuses = await prisma.campus.findMany({
            include: {
                schools: true
            }
        });

        res.status(200).json({
            message: 'Campuses fetched successfully',
            campuses
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for getting a single campus
export const getCampus = async (req, res, next) => {
    try {
        const { id } = req.params;

        const campus = await prisma.campus.findUnique({
            where: { id },
            include: {
                schools: true
            }
        });

        if (!campus) {
            const error = new Error('Campus not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            message: 'Campus fetched successfully',
            campus
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for updating a campus
export const updateCampus = async (req, res, next) => {
    try {
        const { campusId } = req.params;
        const { name, location } = req.body;

        const campus = await prisma.campus.update({
            where: { id: campusId },
            data: {
                name,
                location
            }
        });

        res.status(200).json({
            message: 'Campus updated successfully',
            campus
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for deleting a campus
export const deleteCampus = async (req, res, next) => {
    try {
        const { campusId } = req.params;

        await prisma.campus.delete({
            where: { id: campusId }
        });

        res.status(200).json({
            message: 'Campus deleted successfully'
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


// Controller for adding a new school
export const addSchool = async (req, res, next) => {
    try {
        const { name, code, url, campusId } = req.body;

        // Check if school with code and campus already exists
        const existingSchool = await prisma.school.findFirst({
            where: { 
                AND: [
                    { code },
                    { campusId }
                ]
            }
        });

        if (existingSchool) {
            const error = new Error('School with this code already exists in this campus');
            error.statusCode = 400;
            throw error;
        }

        // Create new school and update campus
        const school = await prisma.school.create({
            data: {
                name,
                code,
                url,
                campusId
            }
        });

        // Update campus with the new school
        await prisma.campus.update({
            where: { id: campusId },
            data: {
                schools: {
                    connect: { id: school.id }
                }
            }
        });

        res.status(201).json({
            message: 'School created successfully',
            school
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for adding Dean and PA to a school
export const addSchoolMembers = async (req, res, next) => {
    try {
        const { schoolId } = req.params;
        const { dean, pa } = req.body;

        console.log('schoolId', schoolId);
        // Check if school exists
        const school = await prisma.school.findUnique({
            where: { id: schoolId }
        });

        if (!school) {
            const error = new Error('School not found');
            error.statusCode = 404;
            throw error;
        }

        let deanMember = null;
        // Only process dean if details provided
        if (dean && dean.email) {
            // Check if dean email already exists
            const existingDean = await prisma.schoolMember.findFirst({
                where: { email: dean.email }
            });

            if (existingDean) {
                const error = new Error('Dean with this email already exists');
                error.statusCode = 400;
                throw error;
            }

            // Find current dean if exists and make them not current
            const currentDean = await prisma.schoolMember.findFirst({
                where: {
                    schoolId,
                    role: 'Dean',
                    isCurrent: true
                }
            });

            if (currentDean) {
                await prisma.schoolMember.update({
                    where: { id: currentDean.id },
                    data: { isCurrent: false }
                });
            }

            // Create Dean
            deanMember = await prisma.schoolMember.create({
                data: {
                    schoolId,
                    name: dean.name,
                    contact: dean.contact,
                    email: dean.email,
                    role: 'Dean',
                    isCurrent: dean.isCurrent || true
                }
            });
        }

        let paMember = null;
        // Create PA only if PA details are provided
        if (pa) {
            paMember = await prisma.schoolMember.create({
                data: {
                    schoolId,
                    name: pa.name,
                    contact: pa.contact,
                    email: pa.email,
                    role: 'Personal Assistant',
                    isCurrent: pa.isCurrent || true
                }
            });
        }

        res.status(201).json({
            message: 'School members added successfully',
            ...(deanMember && { dean: deanMember }),
            ...(paMember && { pa: paMember })
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for updating school members
export const updateSchoolMembers = async (req, res, next) => {
    try {
        const { schoolId } = req.params;
        const { dean, pa } = req.body;

        console.log('dean', dean);

        // Update Dean
        if (dean) {
            // Check if a school member with the given email already exists
            const existingDean = await prisma.schoolMember.findUnique({
                where: { email: dean.email }
            });

            if (existingDean) {
                // If the existing member is not the current dean, update their details
                if (existingDean.role !== 'Dean' || existingDean.schoolId !== schoolId) {
                    await prisma.schoolMember.update({
                        where: { id: existingDean.id },
                        data: {
                            schoolId,
                            name: dean.name,
                            contact: dean.contact,
                            role: 'Dean',
                            isCurrent: true
                        }
                    });
                } else {
                    // If the existing member is already the current dean, update their details
                    await prisma.schoolMember.update({
                        where: { id: existingDean.id },
                        data: {
                            name: dean.name,
                            contact: dean.contact,
                            isCurrent: true
                        }
                    });
                }
            } else {
                // If no member with the email exists, create a new dean
                await prisma.schoolMember.create({
                    data: {
                        schoolId,
                        name: dean.name,
                        contact: dean.contact,
                        email: dean.email,
                        role: 'Dean',
                        isCurrent: true
                    }
                });
            }
        }

        // Update PA
        if (pa) {
            // Check if a school member with the given email already exists
            const existingPA = await prisma.schoolMember.findUnique({
                where: { email: pa.email }
            });

            if (existingPA) {
                // If the existing member is not the current PA, update their details
                if (existingPA.role !== 'Personal Assistant' || existingPA.schoolId !== schoolId) {
                    await prisma.schoolMember.update({
                        where: { id: existingPA.id },
                        data: {
                            schoolId,
                            name: pa.name,
                            contact: pa.contact,
                            role: 'Personal Assistant',
                            isCurrent: true
                        }
                    });
                } else {
                    // If the existing member is already the current PA, update their details
                    await prisma.schoolMember.update({
                        where: { id: existingPA.id },
                        data: {
                            name: pa.name,
                            contact: pa.contact,
                            isCurrent: true
                        }
                    });
                }
            } else {
                // If no member with the email exists, create a new PA
                await prisma.schoolMember.create({
                    data: {
                        schoolId,
                        name: pa.name,
                        contact: pa.contact,
                        email: pa.email,
                        role: 'Personal Assistant',
                        isCurrent: true
                    }
                });
            }
        }

        // Get updated school members
        const updatedMembers = await prisma.schoolMember.findMany({
            where: {
                schoolId,
                isCurrent: true
            }
        });

        res.status(200).json({
            message: 'School members updated successfully',
            members: updatedMembers
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};



// Controller for adding a new department to a school
export const addDepartment = async (req, res, next) => {
    try {
        const { schoolId } = req.params;
        const { name, url, adminName, adminContact, adminEmail } = req.body;

        // Check if school exists
        const school = await prisma.school.findUnique({
            where: { id: schoolId }
        });

        if (!school) {
            const error = new Error('School not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if department with same name already exists in this school
        const existingDepartment = await prisma.department.findFirst({
            where: { 
                name,
                schoolId
            }
        });

        if (existingDepartment) {   
            const error = new Error('Department with this name already exists in this school');
            error.statusCode = 400;
            throw error;
        }   

        // Create new department
        const department = await prisma.department.create({
            data: { 
                name,
                url,
                adminName,
                adminContact, 
                adminEmail,
                schoolId
            }
        }); 

        res.status(201).json({
            message: 'Department created successfully',
            department
        });     

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for getting all departments of a school
export const getAllDepartments = async (req, res, next) => {
    try {
        const { schoolId } = req.params;

        // Check if school exists
        const school = await prisma.school.findUnique({
            where: { id: schoolId }
        });

        if (!school) {
            const error = new Error('School not found');
            error.statusCode = 404;
            throw error;
        }

        const departments = await prisma.department.findMany({
            where: { schoolId },
            include: {
                school: true
            }
        });

        res.status(200).json({
            message: 'Departments fetched successfully',
            departments
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for getting a specific department
export const getDepartment = async (req, res, next) => {
    try {
        const { schoolId, departmentId } = req.params;

        const department = await prisma.department.findFirst({
            where: {
                AND: [
                    { id: departmentId },
                    { schoolId }
                ]
            },
            include: {
                school: true
            }
        });

        if (!department) {
            const error = new Error('Department not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            message: 'Department fetched successfully',
            department
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for updating a department
export const updateDepartment = async (req, res, next) => {
    try {
        const { schoolId, departmentId } = req.params;
        const { name, url, adminName, adminContact, adminEmail } = req.body;

        // Check if department exists
        const existingDepartment = await prisma.department.findFirst({
            where: {
                AND: [
                    { id: departmentId },
                    { schoolId }
                ]
            }
        });

        if (!existingDepartment) {
            const error = new Error('Department not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if new name conflicts with another department in same school
        if (name && name !== existingDepartment.name) {
            const duplicateDepartment = await prisma.department.findFirst({
                where: {
                    AND: [
                        { name },
                        { schoolId },
                        { id: { not: departmentId } }
                    ]
                }
            });

            if (duplicateDepartment) {
                const error = new Error('Department with this name already exists in this school');
                error.statusCode = 400;
                throw error;
            }
        }

        // Update department
        const updatedDepartment = await prisma.department.update({
            where: { id: departmentId },
            data: {
                name,
                url,
                adminName,
                adminContact,
                adminEmail
            }
        });

        res.status(200).json({
            message: 'Department updated successfully',
            department: updatedDepartment
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for deleting a department
export const deleteDepartment = async (req, res, next) => {
    try {
        const { schoolId, departmentId } = req.params;

        // Check if department exists
        const department = await prisma.department.findFirst({
            where: {
                AND: [
                    { id: departmentId },
                    { schoolId }
                ]
            }
        });

        if (!department) {
            const error = new Error('Department not found');
            error.statusCode = 404;
            throw error;
        }

        // Delete department
        await prisma.department.delete({
            where: { id: departmentId }
        });

        res.status(200).json({
            message: 'Department deleted successfully'
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


// Controller for getting all schools
export const getAllSchools = async (req, res, next) => {
    try {

        console.log('getAllSchools');
        const schools = await prisma.school.findMany({
            include: {
                campus: true,
                departments: true,
                members: true
            }
        });

        res.status(200).json({
            message: 'Schools fetched successfully',
            schools
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for getting a specific school
export const getSchool = async (req, res, next) => {
    try {
        const { schoolId } = req.params;

        const school = await prisma.school.findUnique({
            where: { id: schoolId },
            include: {
                campus: true,
                departments: true,
                members: true
            }
        });

        if (!school) {
            const error = new Error('School not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            message: 'School fetched successfully',
            school
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for updating a school
export const updateSchool = async (req, res, next) => {
    try {
        const { schoolId } = req.params;
        const { name, code, url } = req.body;

        const updatedSchool = await prisma.school.update({
            where: { id: schoolId },
            data: {
                name,
                code,
                url
            },
            include: {
                campus: true,
                departments: true,
                members: true
            }
        });

        res.status(200).json({
            message: 'School updated successfully',
            school: updatedSchool
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for deleting a school
export const deleteSchool = async (req, res, next) => {
    try {
        const { schoolId } = req.params;

        // First remove the school reference from campus
        const school = await prisma.school.findUnique({
            where: { id: schoolId },
            select: { campusId: true }
        });

        await prisma.campus.update({
            where: { id: school.campusId },
            data: {
                schoolIds: {
                    set: await prisma.campus.findUnique({
                        where: { id: school.campusId },
                        select: { schoolIds: true }
                    }).then(campus => 
                        campus.schoolIds.filter(id => id !== schoolId)
                    )
                }
            }
        });

        // Then delete the school
        await prisma.school.delete({
            where: { id: schoolId }
        });

        res.status(200).json({
            message: 'School deleted successfully'
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for creating a faculty member
export const createFacultyMember = async (req, res, next) => {
    try {
        const { 
            name,
            workEmail,
            personalEmail,
            primaryPhone,
            secondaryPhone,
            designation,
            schoolId,
            campusId,
            facultyType,
          
            employeeId,
            password 
        } = req.body;

        // Check if faculty member already exists
        const existingFaculty = await prisma.facultyMember.findUnique({
            where: { workEmail }
        });

        if (existingFaculty) {
            const error = new Error('Faculty member with this work email already exists');
            error.statusCode = 400;
            throw error;
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email: workEmail }
        });

        if (existingUser) {
            const error = new Error('User with this email already exists');
            error.statusCode = 400;
            throw error;
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Determine role based on facultyType
        let role;
        if (facultyType === 'dean') {
            role = 'DEAN';
        } else if (facultyType === 'school pa') {
            role = 'SCHOOL_PA';
        } else if (facultyType === 'school admin') {
            role = 'SCHOOL_ADMIN';
        } else {
            role = 'FACULTY';
        }

        // Create user first
        const user = await prisma.user.create({
            data: {
                name,
                email: workEmail,
                designation,
                password: hashedPassword,
                role,
                phone: primaryPhone
            }
        });

        // Create faculty member and link user
        const facultyMember = await prisma.facultyMember.create({
            data: {
                name,
                workEmail,
                personalEmail,
                primaryPhone,
                secondaryPhone,
                designation,
                school: { connect: { id: schoolId } },
                campus: { connect: { id: campusId } },
                facultyType,
                role,
                isAdmin: facultyType === 'school admin' ? true : false,
                employeeId,
                user: { connect: { id: user.id } }
            }
        });


        res.status(201).json({
            message: 'Faculty member created successfully',
            facultyMember
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};





// Controller for getting all faculty members
export const getAllFacultyMembers = async (req, res, next) => {
    try {
        const [facultyMembers, supervisors] = await Promise.all([
            prisma.facultyMember.findMany({
                include: {
                    school: true,
                    campus: true
                }
            }),
            prisma.supervisor.findMany({
                include: {
                    school: true,
                    campus: true,
                    department: true
                }
            })
        ]);

        res.status(200).json({facultyMembers: [
            ...facultyMembers,
            ...supervisors
        ]}
          );
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for getting a single faculty member
export const getFacultyMember = async (req, res, next) => {
    try {
        const { facultyId } = req.params;

        const facultyMember = await prisma.facultyMember.findUnique({
            where: { id: facultyId },
            include: {
                school: true,
                user: true
            }
        });

        if (!facultyMember) {
            const error = new Error('Faculty member not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            facultyMember
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for updating a faculty member
export const updateFacultyMember = async (req, res, next) => {
    try {
        const { facultyId } = req.params;
        const {schoolId, campusId, userId, ...updateData} = req.body;

        // Get existing faculty member data before update
        const existingFacultyMember = await prisma.facultyMember.findUnique({
            where: { id: facultyId }
        });

        if (!existingFacultyMember) {
            const error = new Error('Faculty member not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if email is being changed and if it already exists
        if (updateData.workEmail !== existingFacultyMember.workEmail) {
            const emailExists = await prisma.user.findUnique({
                where: { email: updateData.workEmail }
            });

            if (emailExists) {
                const error = new Error('Work email already exists');
                error.statusCode = 400;
                throw error;
            }

            // Update the user's email
            await prisma.user.update({
                where: { id: existingFacultyMember.user.id },
                data: { email: updateData.workEmail }
            });
        }

        // Track changes
        const changes = [];
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== existingFacultyMember[key]) {
                changes.push({
                    field: key,
                    oldValue: existingFacultyMember[key],
                    newValue: updateData[key]
                });
            }
        });

        const updatedFacultyMember = await prisma.facultyMember.update({
            where: { id: facultyId },
            data: {
                ...updateData,
                school: { connect: { id: schoolId} },
                campus: { connect: { id: campusId } },
                user: { connect: { id: userId } }
            },
            include: {
                campus: true,
                school: true,
                user: true
            }
        });

        // Log the activity
        await prisma.userActivity.create({
            data: {
                action: 'UPDATE_FACULTY',
                entityId: facultyId,
                entityType: 'FACULTY',
                details: JSON.stringify(changes),
                userId: req.user.id, // Assuming req.user contains logged in user details
               
            }
        });

        res.status(200).json({
            message: 'Faculty member updated successfully',
            facultyMember: updatedFacultyMember
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for changing a faculty member's password
export const changeFacultyPassword = async (req, res, next) => {
    try {
        const { facultyId } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) {
            const error = new Error('New password is required');
            error.statusCode = 400;
            throw error;
        }

        // Get faculty with associated user
        const faculty = await prisma.facultyMember.findUnique({
            where: { id: facultyId },
            include: { user: true }
        });

        if (!faculty) {
            const error = new Error('Faculty member not found');
            error.statusCode = 404;
            throw error;
        }

        if (!faculty.user) {
            const error = new Error('No user account associated with this faculty member');
            error.statusCode = 404;
            throw error;
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update the user's password
        await prisma.user.update({
            where: { id: faculty.user.id },
            data: { password: hashedPassword }
        });

        res.status(200).json({
            message: 'Faculty password updated successfully'
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


// Controller for deleting a faculty member
export const deleteFacultyMember = async (req, res, next) => {
    try {
        const { facultyId } = req.params;

        // Get faculty member with associated user and activities
        const faculty = await prisma.facultyMember.findUnique({
            where: { id: facultyId },
            include: { 
                user: {
                    include: {
                        activities: true
                    }
                }
            }
        });

        if (!faculty) {
            const error = new Error('Faculty member not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if user has any activities
        if (faculty.user?.activities?.length > 0) {
            const error = new Error('Cannot delete faculty member with existing user activities');
            error.statusCode = 400;
            throw error;
        }

        // Delete the associated user if it exists and has no activities
        if (faculty.user) {
            await prisma.user.delete({
                where: { id: faculty.user.id }
            });
        }

        // Delete the faculty member
        await prisma.facultyMember.delete({
            where: { id: facultyId }
        });

        // Create user activity log
        await prisma.userActivity.create({
            data: {
                action: "Deleted Faculty Member",
                entityType: "FacultyMember", 
                entityId: facultyId,
                userId: req.user?.id,
                details: JSON.stringify({
                    facultyName: faculty.name,
                    facultyEmail: faculty.email,
                    hadUserAccount: !!faculty.user
                })
            }
        });

        res.status(200).json({
            message: 'Faculty member and associated user deleted successfully'
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for creating a supervisor
export const createSupervisor = async (req, res, next) => {
    try {
        const {
            name,
            title,
            workEmail,
            personalEmail,
            primaryPhone,
            secondaryPhone,
            designation,
            schoolId,
            campusId,
            departmentId,
            facultyType,
            employeeId,
            password
        } = req.body;

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Set role based on faculty type
        let role = 'SUPERVISOR';

        // Create user first
        const user = await prisma.user.create({
            data: {
                name,
                title,
                email: workEmail,
                designation,
                password: hashedPassword,
                role,
                phone: primaryPhone
            }
        });

        // Create supervisor and link user
        const supervisor = await prisma.supervisor.create({
            data: {
                title,
                name,
                workEmail,
                personalEmail,
                primaryPhone,
                secondaryPhone,
                designation,
                school: { connect: { id: schoolId } },
                campus: { connect: { id: campusId } },
                department: { connect: { id: departmentId } },
                facultyType,
                role,
                employeeId,
                user: { connect: { id: user.id } }
            }
        });

        res.status(201).json({
            message: 'Supervisor created successfully',
            supervisor
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for getting all supervisors
export const getAllSupervisors = async (req, res, next) => {
    try {
        const supervisors = await prisma.supervisor.findMany({
            include: {
                school: true,
                campus: true,
                department: true,
                students: {
                    include: {
                        statuses: {
                            include: {
                                definition: true
                            }
                        }
                    }
                },
               
            }
        });

        res.status(200).json({
            supervisors
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for getting a single supervisor
export const getSupervisor = async (req, res, next) => {
    try {
        const { supervisorId } = req.params;

        const supervisor = await prisma.supervisor.findUnique({
            where: { id: supervisorId },
            include: {
                school: true,
                campus: true,
                department: true,
                
            }
        });

        if (!supervisor) {
            const error = new Error('Supervisor not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            supervisor
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for updating a supervisor
export const updateSupervisor = async (req, res, next) => {
    try {
        const { supervisorId } = req.params;
        const { schoolId, campusId, departmentId, userId, ...updateData } = req.body;

        // Get existing supervisor data before update
        const existingSupervisor = await prisma.supervisor.findUnique({
            where: { id: supervisorId },
            include: {
                user: true
            }
        });

        if (!existingSupervisor) {
            const error = new Error('Supervisor not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if email is being changed and if it already exists
        if (updateData.workEmail !== existingSupervisor.workEmail) {
            const emailExists = await prisma.user.findUnique({
                where: { email: updateData.workEmail }
            });

            if (emailExists) {
                const error = new Error('Work email already exists');
                error.statusCode = 400;
                throw error;
            }

            // Update the user's email
            await prisma.user.update({
                where: { id: existingSupervisor.user.id },
                data: { email: updateData.workEmail }
            });
        }

        // Track changes
        const changes = [];
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== existingSupervisor[key]) {
                changes.push({
                    field: key,
                    oldValue: existingSupervisor[key],
                    newValue: updateData[key]
                });
            }
        });

        const updatedSupervisor = await prisma.supervisor.update({
            where: { id: supervisorId },
            data: {
                ...updateData,
                school: schoolId ? { connect: { id: schoolId } } : undefined,
                campus: campusId ? { connect: { id: campusId } } : undefined,
                department: departmentId ? { connect: { id: departmentId } } : undefined
            },
            include: {
                school: true,
                campus: true,
                department: true,
                user: true
            }
        });

        res.status(200).json({
            message: 'Supervisor updated successfully',
            supervisor: updatedSupervisor,
            changes
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for deleting a supervisor
export const deleteSupervisor = async (req, res, next) => {
    try {
        const { supervisorId } = req.params;

        const supervisor = await prisma.supervisor.findUnique({
            where: { id: supervisorId },
            include: {
                user: true,
                students: true
            }
        });

        if (!supervisor) {
            const error = new Error('Supervisor not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if supervisor has any students
        if (supervisor.students.length > 0) {
            const error = new Error('Cannot delete supervisor with assigned students');
            error.statusCode = 400;
            throw error;
        }

        // Delete associated user
        await prisma.user.delete({
            where: { id: supervisor.user.id }
        });

        // Delete supervisor
        await prisma.supervisor.delete({
            where: { id: supervisorId }
        });

        res.status(200).json({
            message: 'Supervisor deleted successfully'
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for assigning students to supervisor
export const assignStudentsToSupervisor = async (req, res, next) => {
    try {
        const { supervisorId } = req.params;
        const { studentIds } = req.body;

        // Check if supervisor exists
        const supervisor = await prisma.supervisor.findUnique({
            where: { id: supervisorId },
            include: {
                user: true
            }
        });

        if (!supervisor) {
            const error = new Error('Supervisor not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if all students exist and if they already have supervisors
        const students = await prisma.student.findMany({
            where: {
                id: {
                    in: studentIds
                }
            },
            include: {
                supervisors: true
            }
        });

        if (students.length !== studentIds.length) {
            const error = new Error('One or more students not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if any student already has a supervisor
        const studentsWithSupervisors = students.filter(student => student.supervisors.length > 0);
        if (studentsWithSupervisors.length > 0) {
            const error = new Error('One or more students already have supervisors assigned');
            error.statusCode = 400;
            error.details = studentsWithSupervisors.map(student => student.id);
            throw error;
        }

        // Get normal progress status definition
        const normalProgressStatus = await prisma.statusDefinition.findFirst({
            where: {
                name: 'normal progress'
            }
        });

        if (!normalProgressStatus) {
            const error = new Error('Normal Progress status definition not found');
            error.statusCode = 404;
            throw error;
        }

        // Update all students to be assigned to this supervisor and update their status
        const updatePromises = studentIds.map(async studentId => {
            // First update all existing statuses to not current
            await prisma.studentStatus.updateMany({
                where: { 
                    studentId: studentId,
                    isCurrent: true
                },
                data: { isCurrent: false, endDate: new Date() }
            });

            // Create new normal progress status
            await prisma.studentStatus.create({
                data: {
                    student: { connect: { id: studentId } },
                    definition: { connect: { id: normalProgressStatus.id } },
                    isCurrent: true,
                    startDate: new Date(),
                    conditions: "Normal Progress",
                    isActive: true
                }
            });

            // Assign supervisor
            return prisma.student.update({
                where: { id: studentId },
                data: { supervisors: { connect: { id: supervisorId } } }
            });
        });

        await Promise.all(updatePromises);

        // Get updated students with their details
        const updatedStudents = await prisma.student.findMany({
            where: {
                id: {
                    in: studentIds
                }
            },
            include: {
                campus: true,
                statuses: {
                    where: {
                        isCurrent: true
                    },
                    include: {
                        definition: true
                    }
                }
            }
        });

        // Track this activity
        await prisma.userActivity.create({
            data: {
                user: { connect: { id: req.user?.id } },
                action: 'ASSIGN_STUDENTS',
                entityType: 'Supervisor',
                entityId: supervisorId,
                details: JSON.stringify({
                    supervisorId,
                    studentIds,
                    description: `Assigned ${studentIds.length} student(s) to supervisor ${supervisor.user.name}`,
                })
            }
        });

        res.status(200).json({
            message: 'Students assigned successfully',
            students: updatedStudents
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


// Get students assigned to supervisor
export const getAssignedStudents = async (req, res, next) => {
    try {
        const { supervisorId } = req.params;

        // Check if supervisor exists
        const supervisor = await prisma.supervisor.findUnique({
            where: { id: supervisorId },
            include: {
                user: true
            }
        });

        if (!supervisor) {
            const error = new Error('Supervisor not found');
            error.statusCode = 404;
            throw error;
        }

        // Get all students assigned to this supervisor
        const assignedStudents = await prisma.student.findMany({
            where: {
                supervisors: {
                    some: {
                        id: supervisorId
                    }
                }
            },
            include: {
                campus: true,
                statuses: {
                    
                    include: {
                        definition: true
                    }
                },
                school: true,
                department: true
            }
        });

        res.status(200).json({
            message: 'Students retrieved successfully',
            supervisor: {
                id: supervisor.id,
                name: supervisor.user.name,
                email: supervisor.user.email
            },
            students: assignedStudents
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};



// Controller for creating a new student
export const createStudent = async (req, res, next) => {
    let createdUser = null;
    try {
        const {
            title,
            firstName,
            lastName,
            course,
            email,
            phoneNumber,
            dateOfBirth,
            gender,
            campusId,
            schoolId,
            departmentId,
            academicYear,
            studyMode,
            intakePeriod,
            programLevel,
            specialization,
            completionTime,
            expectedCompletionDate,
            password
        } = req.body;

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            const error = new Error('User with this email already exists');
            error.statusCode = 409;
            throw error;
        }

        // Check if student already exists
        const existingStudent = await prisma.student.findUnique({
            where: { email }
        });

        if (existingStudent) {
            const error = new Error('Student with this email already exists');
            error.statusCode = 409;
            throw error;
        }

        // Create user first
        const user = await prisma.user.create({
            data: {
                name: `${firstName} ${lastName}`,
                email,
                password,
                phone: phoneNumber,
                role: "STUDENT"
            }
        });

        createdUser = user;

        // Then create student with user connection
        const student = await prisma.student.create({
            data: {
                title,
                firstName,
                lastName,
                email,
                course,
                phoneNumber,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                gender,
                campus: {
                    connect: { id: campusId }
                },
                school: {
                    connect: { id: schoolId }
                },
                department: {
                    connect: { id: departmentId }
                },
                academicYear,
                studyMode,
                intakePeriod,
                programLevel,
                specialization,
                completionTime : completionTime ? parseInt(completionTime) : null,
                expectedCompletionDate: expectedCompletionDate ? new Date(expectedCompletionDate) : null,
                currentStatus: "WORKSHOP",
                user: {
                    connect: { id: user.id }
                }
            },
            include: {
                campus: true,
                school: true,
                department: true,
                statuses: true,
                supervisors: true,
                user: true
            }
        });

        // Ensure ADMITTED statusDefinition exists or create it
        let admittedStatusDefinition = await prisma.statusDefinition.findFirst({
            where: {
                name: {
                    in: ["ADMITTED", "admitted"]
                }
            }
        });

        if (!admittedStatusDefinition) {
            admittedStatusDefinition = await prisma.statusDefinition.create({
                data: {
                    name: "ADMITTED",
                    description: "Student has been admitted to the system"
                }
            });
        }

        // Create ADMITTED status for student
        const admittedStatus = await prisma.studentStatus.create({
            data: {
                student: {
                    connect: { id: student.id }
                },
                definition: {
                    connect: { id: admittedStatusDefinition.id }
                },
                startDate: new Date(),
                endDate: new Date(),
                conditions: "Initial admission",
                updatedBy: {
                    connect: { id: req.user?.id }
                },
                isCurrent: false
            }
        });

        // Ensure WORKSHOP statusDefinition exists or create it
        let workshopStatusDefinition = await prisma.statusDefinition.findFirst({
            where: {
                name: {
                    in: ["WORKSHOP", "workshop"]
                }
            }
        });

        if (!workshopStatusDefinition) {
            workshopStatusDefinition = await prisma.statusDefinition.create({
                data: {
                    name: "WORKSHOP",
                    description: "Student is in workshop phase"
                }
            });
        }

        // Create WORKSHOP status for student
        const workshopStatus = await prisma.studentStatus.create({
            data: {
                student: {
                    connect: { id: student.id }
                },
                definition: {
                    connect: { id: workshopStatusDefinition.id }
                },
                startDate: new Date(),
                conditions: "Initial workshop phase",
                isActive: true,
                isCurrent: true
            }
        });

        // Add the statuses to the student object
        student.studentStatuses = [admittedStatus, workshopStatus];

        // Create user activity log
        await prisma.userActivity.create({
            data: {
                action: "Created Student",
                entityType: "Student",
                entityId: student.id,
                userId: req.user?.id
            }
        });

        // Find superadmin and Research_Admin users to notify
        const adminUsers = await prisma.user.findMany({
            where: {
                isActive: true,
                role: {
                    in: ["SUPERADMIN", "RESEARCH_ADMIN"]
                }
            },
            take: 2
        }); 

        console.log("adminUsers",adminUsers);

        // enum NotificationRecipientType {  // Renamed to avoid conflicts
        //     USER
        //     STUDENT
        //     EXAMINER
        //     SUPERVISOR
        //     PANELIST
        //     EXTERNAL
        //   }

        // Schedule notifications for admin users about new student in workshop phase
        for (const admin of adminUsers) {
            await notificationService.scheduleNotification({
                type: "EMAIL",
                statusType: "PENDING",
                title: "New Student in Workshop Phase",
                message: `A new student, ${firstName} ${lastName}, has been added to the system and is currently in the Workshop phase.`,
                recipientCategory: "USER",
                recipientId: admin.id,
                recipientEmail: admin.email,
                recipientName: admin.name,
                scheduledFor: new Date(Date.now() + 1000 * 60 * 5), // Schedule for 5 minutes from now
                metadata: {
                    studentId: student.id,
                    statusName: "WORKSHOP",
                    statusId: workshopStatus.id
                },
                studentStatus: {
                    connect: { id: workshopStatus.id }
                }
            });
        }

        res.status(201).json({
            message: 'Student created successfully',
            student
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        if (createdUser) {
            await prisma.user.delete({
                where: { id: createdUser.id }
            });
        }
        next(error);
    }
};

export const updateStudent = async (req, res, next) => {
    try {
        const { studentId } = req.params;
        const updateData = req.body;

        // Get current student data to compare changes
        const currentStudent = await prisma.student.findUnique({
            where: { id: studentId }
        });

        // Track changes
        const changes = [];
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== currentStudent[key]) {
                changes.push({
                    field: key,
                    oldValue: currentStudent[key],
                    newValue: updateData[key]
                });
            }
        });

        // Update student with all fields from request body
        const updatedStudent = await prisma.student.update({
            where: { id: studentId },
            data: {
                ...updateData,
                // Handle date fields specifically
                dateOfBirth: updateData.dateOfBirth ? new Date(updateData.dateOfBirth) : undefined,
                expectedCompletionDate: updateData.expectedCompletionDate ? new Date(updateData.expectedCompletionDate) : undefined
            },
            include: {
                campus: true,
                school: true,
                department: true,
                statuses: true,
                supervisors: true,
                user: true
            }
        });

        // Create user activity log with tracked changes
        await prisma.userActivity.create({
            data: {
                action: "Updated Student",
                entityType: "Student",
                entityId: studentId,
                userId: req.user?.id,
                details: JSON.stringify(changes) // Store the tracked changes
            }
        });

        res.status(200).json({
            message: 'Student updated successfully',
            student: updatedStudent,
            changes // Include changes in response
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for changing a student's password
export const changeStudentPassword = async (req, res, next) => {
    try {
        const { studentId } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) {
            const error = new Error('New password is required');
            error.statusCode = 400;
            throw error;
        }

        // Get student with associated user
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: { user: true }
        });

        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        if (!student.user) {
            const error = new Error('No user account associated with this student');
            error.statusCode = 404;
            throw error;
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update user password
        await prisma.user.update({
            where: { id: student.user.id },
            data: { password: hashedPassword }
        });

        // Create user activity log
        await prisma.userActivity.create({
            data: {
                action: "Changed Student Password",
                entityType: "Student",
                entityId: studentId,
                userId: req.user?.id,
                details: JSON.stringify({
                    message: "Student password was changed"
                })
            }
        });

        res.status(200).json({
            message: 'Student password updated successfully'
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


export const deleteStudent = async (req, res, next) => {
    try {
        const { studentId } = req.params;

        // Get student with associated user
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: { user: true }
        });

        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        // Delete student's user account if it exists
        if (student.user) {
            await prisma.user.delete({
                where: { id: student.user.id }
            });
        }

        // Delete student's statuses
        await prisma.studentStatus.deleteMany({
            where: { studentId: studentId }
        });

        // Delete student record
        await prisma.student.delete({
            where: { id: studentId }
        });

        // Create user activity log
        await prisma.userActivity.create({
            data: {
                action: "Deleted Student",
                entityType: "Student",
                entityId: studentId,
                userId: req.user?.id,
                details: JSON.stringify({
                    message: "Student, associated user account, and statuses were deleted"
                })
            }
        });

        res.status(200).json({
            message: 'Student, associated user account, and statuses deleted successfully'
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

export const getStudent = async (req, res, next) => {
    try {
        const { studentId } = req.params;

        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                statuses: {
                    include: {
                        definition: true
                    }
                    },
                supervisors: true,
                proposals: true,
                notifications: true,
                fieldWork: true,
              
                school: true,
                campus: true,
                department: true,
                user: true
            }
        });

        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            student
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

export const getAllStudents = async (req, res, next) => {
    try {
        const students = await prisma.student.findMany({
            include: {
                statuses: {
                    include: {
                        definition: true
                    }
                },
                supervisors: true,
                proposals: true,
                notifications: true,
                fieldWork: true,
               
                school: true,
                campus: true,
                department: true,
                user: true
            }
        });

        res.status(200).json({
            students
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller to get student statuses with update history
export const getStudentStatuses = async (req, res, next) => {
    try {
        const { studentId } = req.params;

        // Check if student exists
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                statuses: {
                    include: {
                        definition: true,
                        updatedBy: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true
                            }
                        },
                        notificationsSent: {
                            select: {
                                recipients: true,
                                type: true,
                                message: true,
                                sentAt: true,
                                studentStatus: true
                            }
                        }
                    },
                    orderBy: {
                        updatedAt: 'desc'
                    }
                }
            }
        });

        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            statuses: student.statuses
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


// Controller for creating a status definition
// Create a new status definition
export const createStatusDefinition = async (req, res, next) => {
    try {
        const { 
            name,
            description,
            expectedDuration,
            warningDays,
            criticalDays,
            delayDays,
            notifyRoles,
            color,
            isActive
        } = req.body;

        // Validate required fields
        if (!name || !description || !color) {
            const error = new Error('Name, description and color are required fields');
            error.statusCode = 400;
            throw error;
        }

        // Validate numeric fields are positive if provided
        if (expectedDuration && expectedDuration <= 0) {
            const error = new Error('Expected duration must be a positive number');
            error.statusCode = 400;
            throw error;
        }

        // Validate notification days sequence
        if (warningDays && criticalDays && warningDays <= criticalDays) {
            const error = new Error('Warning days must be greater than critical days');
            error.statusCode = 400;
            throw error;
        }

        // Validate roles against schema
        const validRoles = [
            'SUPERADMIN',
            'RESEARCH_ADMIN',
            'SCHOOL_ADMIN',
            'DEAN',
            'SCHOOL_PA',
            'STUDENT',
            'FACULTY',
            'SUPERVISOR',
            'MANAGER',
            'EXAMINER',
            'COORDINATOR',
            'LIBRARIAN',
            'FINANCE_ADMIN',
            'REGISTRY_ADMIN',
            'GRADUATE_SCHOOL'
        ];

        const invalidRoles = notifyRoles?.filter(role => !validRoles.includes(role));
        if (invalidRoles?.length > 0) {
            const error = new Error(`Invalid roles: ${invalidRoles.join(', ')}`);
            error.statusCode = 400;
            throw error;
        }

        const statusDefinition = await prisma.statusDefinition.create({
            data: {
                name,
                description,
                expectedDuration: expectedDuration ? parseInt(expectedDuration) : null,
                warningDays: warningDays ? parseInt(warningDays) : null,
                criticalDays: criticalDays ? parseInt(criticalDays) : null,
                delayDays: delayDays ? parseInt(delayDays) : null,
                notifyRoles: {
                    set: notifyRoles || []
                },
                color,
                isActive: isActive ?? true
            }
        });

        res.status(201).json({
            message: 'Status definition created successfully',
            statusDefinition
        });
    } catch (error) {
        if (error.code === 'P2002') {
            const err = new Error('A status with this name already exists');
            err.statusCode = 409;
            next(err);
            return;
        }
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Get all status definitions
export const getAllStatusDefinitions = async (req, res, next) => {
    try {
        const statusDefinitions = await prisma.statusDefinition.findMany();

        res.status(200).json({
            statusDefinitions
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Get a single status definition by ID
export const getStatusDefinition = async (req, res, next) => {
    try {
        const { id } = req.params;

        const statusDefinition = await prisma.statusDefinition.findUnique({
            where: {
                id: id
            }
        });

        if (!statusDefinition) {
            const error = new Error('Status definition not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            statusDefinition
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Update a status definition
export const updateStatusDefinition = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        const statusDefinition = await prisma.statusDefinition.update({
            where: {
                id: id
            },
            data: {
                name: name
            }
        });

        res.status(200).json({
            message: 'Status definition updated successfully',
            statusDefinition
        });
    } catch (error) {
        if (error.code === 'P2002') {
            const err = new Error('A status with this name already exists');
            err.statusCode = 409;
            next(err);
            return;
        }
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Delete a status definition
export const deleteStatusDefinition = async (req, res, next) => {
    try {
        const { id } = req.params;

        await prisma.statusDefinition.delete({
            where: {
                id: id
            }
        });

        res.status(200).json({
            message: 'Status definition deleted successfully'
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

/** PROPOSAL MANAGEMENT CONTROLLERS */




// Get all proposals for a student
export const getStudentProposals = async (req, res, next) => {
    try {
        const { studentId } = req.params;

        const proposals = await prisma.proposal.findMany({
            where: {
                studentId: studentId
            },
            include: {
                student: true,
                submittedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true
                    }
                },
                reviewGrades: true,
                defenses: {
                    include: {
                        panelists: true,
                    }
                },
                reviewers: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                panelists: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                statuses: {
                    include: {
                        definition: true
                    }
                }
            },
            orderBy: {
                submittedAt: 'desc'
            }
        });

        res.status(200).json({ proposals });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Get all proposals in a school
export const getAllProposals = async (req, res, next) => {
    try {
        // Get all proposals in the system
        const proposals = await prisma.proposal.findMany({
            include: {
                student: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        campus: true,
                        school: true
                    }
                },
                reviewGrades: {
                    select: {
                        id: true,
                        verdict: true,
                        feedback: true,
                        createdAt: true,
                        gradedBy: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        submittedBy: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                defenseGrades: {
                    select: {
                        id: true,
                        grade: true,
                        feedback: true,
                        createdAt: true,
                        gradedBy: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        submittedBy: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                defenses: {
                    select: {
                        id: true,
                        scheduledDate: true,
                        verdict: true,
                        comments: true,
                        isCurrent:true
                    }
                },
                panelists: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                reviewers: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                statuses: {
                    include: {
                        definition: true
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    // take: 1
                }
            },
            orderBy: {
                submittedAt: 'desc'
            }
        });

        res.status(200).json({
            message: 'All proposals retrieved successfully',
            proposals: proposals
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Get proposal details
export const getProposal = async (req, res, next) => {
    try {
        const { proposalId } = req.params;

        const proposal = await prisma.proposal.findFirst({
            where: {
                id: proposalId,
            
            },
            include: {
                student: true,
                submittedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true
                    }
                },
                reviewers: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                panelists: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                defenseGrades: true,
                reviewGrades: true,
                statuses: {
                    include: {
                        definition: true
                    }
                }
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({ proposal });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};





// Get reviewers for a campus
export const getReviewers = async (req, res, next) => {
    try {
        // Get faculty member to retrieve campus ID
        const User = await prisma.user.findUnique({
            where: {
                id: req.user.id
            },
           
        });

        if (!User ) {
            const error = new Error('User not found');
            error.statusCode = 400;
            throw error;
        }

        // Get all reviewers for the faculty member's campus
        const reviewers = await prisma.reviewer.findMany({
            include: {
                proposals: {
                    include: {
                        student: true,
                        statuses: {
                            include: {
                                definition: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        res.status(200).json({
            message: 'Reviewers retrieved successfully',
            reviewers: reviewers
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Add reviewer mark to proposal
export const addReviewerMark = async (req, res, next) => {
    try {
        const { proposalId, reviewerId } = req.params;
        const { grade, feedback } = req.body;

        // Get the currently logged-in faculty user
        const submittedById = req.user.id;

        // Validate input
        if (!proposalId || !reviewerId || grade === undefined || !feedback) {
            const error = new Error('Invalid input data');
            error.statusCode = 400;
            throw error;
        }

        // Check if proposal exists
        const proposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                reviewGrades: true,
                reviewers: true,
                student: true,
                statuses: {
                    include: {
                        definition: true
                    }
                }
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if reviewer is assigned to proposal
        const isReviewerAssigned = proposal.reviewers.some(reviewer => reviewer.id === reviewerId);

        if (!isReviewerAssigned) {
            const error = new Error('Reviewer is not assigned to this proposal');
            error.statusCode = 400;
            throw error;
        }

        let updatedOrNewGrade;
        // Create or update the review grade
        const existingGrade = proposal.reviewGrades.find(grade => grade.gradedById === reviewerId);

        if (existingGrade) {
            // Update existing grade
            updatedOrNewGrade = await prisma.proposalReviewGrade.update({
                where: { id: existingGrade.id },
                data: { grade, feedback, updatedBy: { connect: { id: submittedById } } }
            });
        } else {
            // Create new grade
            updatedOrNewGrade = await prisma.proposalReviewGrade.create({
                data: {
                    proposal: { connect: { id: proposalId } },
                    gradedBy: { connect: { id: reviewerId } },
                    grade,
                    feedback,
                    submittedBy: { connect: { id: submittedById } }
                }
            });
        }

        // Calculate average grade after update
        const updatedProposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                reviewGrades: true,
                reviewers: true,
                student: true,
                statuses: {
                    include: {
                        definition: true
                    }
                }
            }
        });

      

        // Check if current status is already "Proposal Review Finished"
        const currentStatus = updatedProposal.statuses.find(status => status.isCurrent);
        const isAlreadyFinished = currentStatus?.definition?.name === 'proposal review finished';

        // Only update status if not already finished and all conditions are met
        if (!isAlreadyFinished && updatedProposal.reviewGrades.length === updatedProposal.reviewers.length ) {
            // Update proposal status
            await prisma.proposalStatus.updateMany({
                where: {
                    proposalId,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });

            // Get the status definition ID for "Proposal Review Finished"
            const proposalReviewFinishedStatus = await prisma.statusDefinition.findFirst({
                where: {
                    name: 'proposal review finished'
                }
            });

            if (!proposalReviewFinishedStatus) {
                throw new Error('Status definition not found');
            }

            await prisma.proposalStatus.create({
                data: {
                    proposal: { connect: { id: proposalId } },
                    definition: { connect: { id: proposalReviewFinishedStatus.id } },
                    isCurrent: true,
                    startDate: new Date()
                }
            });

            // Update student status if proposal passed review
            if (updatedProposal.student) {
                await prisma.studentStatus.updateMany({
                    where: {
                        studentId: updatedProposal.student.id,
                        isCurrent: true
                    },
                    data: {
                        isCurrent: false,
                        endDate: new Date()
                    }
                });

                // Get the status definition ID for "Proposal Review Passed"
                // const proposalReviewPassedStatus = await prisma.statusDefinition.findFirst({
                //     where: {
                //         name: 'Proposal Review Passed'
                //     }
                // });

                // if (!proposalReviewPassedStatus) {
                //     throw new Error('Status definition not found');
                // }

                await prisma.studentStatus.create({
                    data: {
                        student: { connect: { id: updatedProposal.student.id } },
                        definition: { connect: { id: proposalReviewFinishedStatus.id } },
                        isCurrent: true,
                        startDate: new Date(),
                        updatedBy: { connect: { id: submittedById } }
                    }
                });
            }
        }

        res.status(existingGrade ? 200 : 201).json({
            message: existingGrade ? 'Reviewer mark updated successfully' : 'Reviewer mark added successfully',
            grade: updatedOrNewGrade,
            averageGrade
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
}


// Delete reviewer from proposal
export const deleteReviewer = async (req, res, next) => {
    try {
        const { proposalId, reviewerId } = req.params;

        // Check if proposal exists
        const proposal = await prisma.proposal.findUnique({
            where: {
                id: proposalId
            },
            include: {
                reviewers: true,
                reviewGrades: true
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if reviewer is assigned to proposal
        const isReviewerAssigned = proposal.reviewers.some(reviewer => reviewer.id === reviewerId);

        if (!isReviewerAssigned) {
            const error = new Error('Reviewer is not assigned to this proposal');
            error.statusCode = 400;
            throw error;
        }

        // Check if reviewer has submitted any grades
        const hasGrades = proposal.reviewGrades.some(grade => grade.reviewerId === reviewerId);

        if (hasGrades) {
            const error = new Error('Cannot remove reviewer who has already submitted grades');
            error.statusCode = 400;
            throw error;
        }

        // Check if reviewer has other proposals assigned
        const otherProposals = await prisma.proposal.findMany({
            where: {
                AND: [
                    {
                        reviewers: {
                            some: {
                                id: reviewerId
                            }
                        }
                    },
                    {
                        id: {
                            not: proposalId
                        }
                    }
                ]
            }
        });

        // Delete reviewer from proposal
        await prisma.proposal.update({
            where: {
                id: proposalId
            },
            data: {
                reviewers: {
                    disconnect: {
                        id: reviewerId
                    }
                }
            }
        });

        // If reviewer has no other proposals, delete the reviewer
        if (otherProposals.length === 0) {
            await prisma.reviewer.delete({
                where: {
                    id: reviewerId
                }
            });
        }

        res.status(200).json({
            message: 'Reviewer removed successfully'
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


/** to be deleted */
// Get panelists for a campus
export const getPanelists = async (req, res, next) => {
    try {
        // Get faculty member to retrieve campus ID
        const facultyMember = await prisma.facultyMember.findUnique({
            where: {
                userId: req.user.id
            },
            select: {
                campusId: true
            }
        });

        if (!facultyMember || !facultyMember.campusId) {
            const error = new Error('Faculty member campus not found');
            error.statusCode = 400;
            throw error;
        }

        // Get all panelists for the faculty member's campus
        const panelists = await prisma.panelist.findMany({
            where: {
                campusId: facultyMember.campusId
            },
            orderBy: {
                name: 'asc'
            }
        });

        res.status(200).json({
            message: 'Panelists retrieved successfully',
            panelists: panelists
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

/** to be deleted */
// Add panelists to proposal
export const addPanelists = async (req, res, next) => {
    try {
        const { proposalId } = req.params;
        const { panelists } = req.body;

        // Validate input
        if (!proposalId || !panelists || !Array.isArray(panelists)) {
            const error = new Error('Invalid input data');
            error.statusCode = 400;
            throw error;
        }

        console.log(panelists);

        // Validate panelist objects
        for (const panelist of panelists) {
            if (!panelist.name || !panelist.email) {
                const error = new Error('Each panelist must have name and email');
                error.statusCode = 400;
                throw error;
            }
        }

        // Get proposal with student details and current status
        const proposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                student: true,
                panelists: true,
                statuses: {
                    where: {
                        isCurrent: true
                    },
                    include: {
                        definition: true
                    }
                }
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        if (!proposal.student) {
            const error = new Error('Student not found for this proposal');
            error.statusCode = 404;
            throw error;
        }

        // Get user's campus
        const faculty = await prisma.facultyMember.findUnique({
            where: { userId: req.user.id },
            select: { campusId: true }
        });

        if (!faculty || !faculty.campusId) {
            const error = new Error('Faculty campus not found');
            error.statusCode = 404;
            throw error;
        }

        // Process each panelist
        const panelistsToAdd = [];
        for (const panelist of panelists) {
            // Check if panelist already exists
            let existingPanelist = await prisma.panelist.findFirst({
                where: {
                    email: panelist.email,
                    campusId: faculty.campusId
                }
            });

            // Create panelist if doesn't exist
            if (!existingPanelist) {
                existingPanelist = await prisma.panelist.create({
                    data: {
                        name: panelist.name,
                        email: panelist.email,
                        campus: {
                            connect: { id: faculty.campusId }
                        }
                    }
                });
            }

            // Check if panelist is already assigned to this proposal
            const alreadyAssigned = proposal.panelists.some(p => p.id === existingPanelist.id);
            if (!alreadyAssigned) {
                panelistsToAdd.push(existingPanelist.id);
            }
        }

        // Add panelists to proposal
        if (panelistsToAdd.length > 0) {
            await prisma.proposal.update({
                where: { id: proposalId },
                data: {
                    panelists: {
                        connect: panelistsToAdd.map(id => ({ id }))
                    }
                }
            });
        }

        // Get updated proposal with panelists
        const updatedProposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                panelists: true
            }
        });

        res.status(200).json({
            message: 'Panelists added successfully',
            panelists: updatedProposal.panelists
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

/** should be delete */
export const addPanelistMark = async (req, res, next) => {
    try {
        const { proposalId, panelistId } = req.params;
        const { grade, feedback } = req.body;

        // Validate input
        if (!proposalId || !panelistId || grade === undefined || feedback === undefined) {
            const error = new Error('Invalid input data');
            error.statusCode = 400;
            throw error;
        }

        // Check if proposal exists
        const proposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                panelists: true,
                defenseGrades: true,
                student: true,
                statuses: {
                    include: {
                        definition: true
                    }
                }
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if panelist is assigned to proposal
        const isPanelistAssigned = proposal.panelists.some(panelist => panelist.id === panelistId);

        if (!isPanelistAssigned) {
            const error = new Error('Panelist is not assigned to this proposal');
            error.statusCode = 400;
            throw error;
        }

        let resultingGrade;

        // Create or update the defense grade
        const existingGrade = proposal.defenseGrades.find(grade => grade.gradedById === panelistId);

        if (existingGrade) {
            // Update existing grade
            resultingGrade = await prisma.proposalDefenseGrade.update({
                where: { id: existingGrade.id },
                data: { grade, feedback, updatedBy: { connect: { id: req.user.id } } }
            });
        } else {
            // Create new grade
            resultingGrade = await prisma.proposalDefenseGrade.create({
                data: {
                    proposal: { connect: { id: proposalId } },
                    gradedBy: { connect: { id: panelistId } },
                    grade,
                    feedback,
                    submittedBy: { connect: { id: req.user.id } }
                }
            });
        }

        // Calculate average if there are multiple grades
        const updatedProposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: { defenseGrades: true }
        });

        if (updatedProposal.defenseGrades.length > 1) {
            const totalGrade = updatedProposal.defenseGrades.reduce((sum, grade) => sum + grade.grade, 0);
            const averageGrade = totalGrade / updatedProposal.defenseGrades.length;

            // Update proposal with average defense mark
            await prisma.proposal.update({
                where: { id: proposalId },
                data: {
                    averageDefenseMark: averageGrade
                }
            });

            // Update proposal status
            await prisma.proposalStatus.updateMany({
                where: {
                    proposalId,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });

            // Get status definitions based on grade
            const passedStatus = await prisma.statusDefinition.findFirst({
                where: { name: 'passed-proposal graded' }
            });

            const failedStatus = await prisma.statusDefinition.findFirst({
                where: { name: 'failed-proposal graded' }
            });

            if (!passedStatus || !failedStatus) {
                throw new Error('Status definitions not found');
            }

            // Create new proposal status
            await prisma.proposalStatus.create({
                data: {
                    proposal: { connect: { id: proposalId } },
                    definition: {
                        connect: {
                            id: averageGrade >= 60 ? passedStatus.id : failedStatus.id
                        }
                    },
                    isCurrent: true,
                    startDate: new Date()
                }
            });

            // Update student status if student exists
            if (proposal.student) {
                // Set current student status to not current
                await prisma.studentStatus.updateMany({
                    where: {
                        studentId: proposal.student.id,
                        isCurrent: true
                    },
                    data: {
                        isCurrent: false,
                        endDate: new Date()
                    }
                });

                // Create new student status
                await prisma.studentStatus.create({
                    data: {
                        student: { connect: { id: proposal.student.id } },
                        definition: { 
                            connect: { 
                                id: averageGrade >= 60 ? passedStatus.id : failedStatus.id 
                            } 
                        },
                        isCurrent: true,
                        startDate: new Date(),
                        updatedBy: { connect: { id: req.user.id } }
                    }
                });
            }
        }

        res.status(existingGrade ? 200 : 201).json({
            message: existingGrade ? 'Panelist mark updated successfully' : 'Panelist mark added successfully',
            grade: resultingGrade
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


// Delete panelist from proposal
export const deletePanelist = async (req, res, next) => {
    try {
        const { proposalId, panelistId } = req.params;

        // Check if proposal exists
        const proposal = await prisma.proposal.findUnique({
            where: {
                id: proposalId
            },
            include: {
                panelists: true,
                defenseGrades: true
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if panelist is assigned to proposal
        const isPanelistAssigned = proposal.panelists.some(panelist => panelist.id === panelistId);

        if (!isPanelistAssigned) {
            const error = new Error('Panelist is not assigned to this proposal');
            error.statusCode = 400;
            throw error;
        }

        // Check if panelist has submitted any grades
        const hasGrades = proposal.defenseGrades.some(grade => grade.panelistId === panelistId);

        if (hasGrades) {
            const error = new Error('Cannot remove panelist who has already submitted grades');
            error.statusCode = 400;
            throw error;
        }

        // Check if panelist has other proposals assigned
        const otherProposals = await prisma.proposal.findMany({
            where: {
                AND: [
                    {
                        panelists: {
                            some: {
                                id: panelistId
                            }
                        }
                    },
                    {
                        id: {
                            not: proposalId
                        }
                    }
                ]
            }
        });

        // Delete panelist from proposal
        await prisma.proposal.update({
            where: {
                id: proposalId
            },
            data: {
                panelists: {
                    disconnect: {
                        id: panelistId
                    }
                }
            }
        });

        // If panelist has no other proposals, delete the panelist and disconnect from all relations
        if (otherProposals.length === 0) {
            // First disconnect from all proposals
            // await prisma.proposal.updateMany({
            //     where: {
            //         panelists: {
            //             some: {
            //                 id: panelistId
            //             }
            //         }
            //     },
            //     data: {
            //         panelists: {
            //             disconnect: {
            //                 id: panelistId
            //             }
            //         }
            //     }
            // });

            // Then delete the panelist
            await prisma.panelist.delete({
                where: {
                    id: panelistId
                }
            });
        }

        res.status(200).json({
            message: 'Panelist removed successfully'
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

/** to be deleted */
// Add defense date to proposal
export const addDefenseDate = async (req, res, next) => {
    try {
        const { proposalId } = req.params;
        const { defenseDate, type } = req.body;

        // Validate input
        if (!proposalId || !defenseDate || !type) {
            const error = new Error('Invalid input data');
            error.statusCode = 400;
            throw error;
        }

        // Check if proposal exists
        const proposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                student: true,
                panelists: true,
                statuses: {
                    where: {
                        isCurrent: true
                    },
                    include: {
                        definition: true
                    }
                }
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        // If type is reschedule, just update the defense date
        if (type === 'reschedule') {
            const updatedProposal = await prisma.proposal.update({
                where: { id: proposalId },
                data: {
                    defenseDate: new Date(defenseDate)
                }
            });

            return res.status(200).json({
                message: 'Defense date rescheduled successfully',
                proposal: updatedProposal
            });
        }

        // For new defense date scheduling, continue with status updates
        // Update current proposal status to not current
        await prisma.proposalStatus.updateMany({
            where: {
                proposalId,
                isCurrent: true
            },
            data: {
                isCurrent: false,
                endDate: new Date()
            }
        });

        // Get the status definition for "waiting for proposal defense"
        const waitingForDefenseStatus = await prisma.statusDefinition.findFirst({
            where: {
                name: 'waiting for proposal defense'
            }
        });

        if (!waitingForDefenseStatus) {
            throw new Error('Status definition not found');
        }

        // Create new proposal status
        await prisma.proposalStatus.create({
            data: {
                proposal: { connect: { id: proposalId } },
                definition: { connect: { id: waitingForDefenseStatus.id } },
                isCurrent: true,
                startDate: new Date()
            }
        });

        // Update student status
        if (proposal.student) {
            // Set current student status to not current
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: proposal.student.id,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });

            // Create new student status
            await prisma.studentStatus.create({
                data: {
                    student: { connect: { id: proposal.student.id } },
                    definition: { connect: { id: waitingForDefenseStatus.id } },
                    isCurrent: true,
                    startDate: new Date(),
                    updatedBy: { connect: { id: req.user.id } }
                }
            });
        }

        // Update proposal with defense date
        const updatedProposal = await prisma.proposal.update({
            where: { id: proposalId },
            data: {
                defenseDate: new Date(defenseDate)
            }
        });

        res.status(200).json({
            message: 'Defense date added successfully',
            proposal: updatedProposal
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

export const addComplianceReportDate = async (req, res, next) => {
    try {
        const { proposalId } = req.params;
        const { complianceReportDate } = req.body;

        // Validate input
        if (!proposalId || !complianceReportDate) {
            const error = new Error('Invalid input data');
            error.statusCode = 400;
            throw error;
        }

        // Check if proposal exists
        const proposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                student: true,
                statuses: {
                    include: {
                        definition: true
                    }
                }
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        // Get status definition for compliance report submitted
        const complianceReportSubmittedStatus = await prisma.statusDefinition.findFirst({
            where: { name: 'compliance report submitted' }
        });

        if (!complianceReportSubmittedStatus) {
            throw new Error('Status definition not found');
        }

        // Update current status to not current
        await prisma.proposalStatus.updateMany({
            where: {
                proposalId,
                isCurrent: true
            },
            data: {
                isCurrent: false,
                endDate: new Date()
            }
        });

        // Create new status for compliance report submitted
        await prisma.proposalStatus.create({
            data: {
                proposal: { connect: { id: proposalId } },
                definition: { connect: { id: complianceReportSubmittedStatus.id } },
                isCurrent: true,
                startDate: new Date()
            }
        });

        // Update student status if student exists
        if (proposal.student) {
            // Set current student status to not current
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: proposal.student.id,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });

            // Create new student status
            await prisma.studentStatus.create({
                data: {
                    student: { connect: { id: proposal.student.id } },
                    definition: { connect: { id: complianceReportSubmittedStatus.id } },
                    isCurrent: true,
                    startDate: new Date(),
                    updatedBy: { connect: { id: req.user.id } }
                }
            });
        }

        // Update proposal with compliance report date
        const updatedProposal = await prisma.proposal.update({
            where: { id: proposalId },
            data: {
                complianceReportDate: new Date(complianceReportDate),
               
            }
        });

        res.status(200).json({
            message: 'Compliance report date added successfully',
            proposal: updatedProposal
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

/** to be deleted */
// Generate and send field letter controller
export const generateFieldLetter = async (req, res, next) => {
    try {
        const { proposalId } = req.params;
        // const { file: req.file } = req;
        const { emailTo } = req.body;
        console.log('here')
        // Validate file exists
        if (!req.file) {
            const error = new Error('No DOCX file provided');
            error.statusCode = 400;
            throw error;
        }

        // Get proposal with related data
        const proposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                student: true,
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        // Get letter to field status definition
        const letterToFieldStatus = await prisma.statusDefinition.findFirst({
            where: { name: 'letter to field issued' }
        });

        if (!letterToFieldStatus) {
            const error = new Error('Letter to field status definition not found');
            error.statusCode = 404;
            throw error;
        }

        // Get fieldwork status definition
        const fieldworkStatus = await prisma.statusDefinition.findFirst({
            where: { name: 'fieldwork' }
        });

        if (!fieldworkStatus) {
            const error = new Error('Fieldwork status definition not found');
            error.statusCode = 404;
            throw error;
        }
        console.log('here ddddd')

        // Convert DOCX to PDF using PDFNet
        let pdfBuffer;
        try {
            pdfBuffer = await PDFNet.runWithCleanup(async () => {
                const pdfdoc = await PDFNet.PDFDoc.create();
                await pdfdoc.initSecurityHandler();
                
                // Create a temporary buffer from the uploaded file
                const docxBuffer = req.file.buffer;
                
                // Convert DOCX to PDF
                await PDFNet.Convert.toPdf(pdfdoc, docxBuffer);
                
                // Save to memory buffer
                return await pdfdoc.saveMemoryBuffer(PDFNet.SDFDoc.SaveOptions.e_linearized);
            });
        } catch (conversionError) {
            console.error('PDF conversion error:', conversionError);
            const error = new Error('Failed to convert DOCX to PDF');
            error.statusCode = 500;
            throw error;
        }

        console.log('here')
        // Send email with PDF attachment
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.NODE_MAILER_USERCRED,
                    pass: process.env.NODE_MAILER_PASSCRED
                }
            });

            await transporter.sendMail({
                to: process.env.NODE_MAILER_EMAIL_TO,
                cc: process.env.NODE_MAILER_EMAIL_CC,
                subject: `Field Letter - ${proposal.student.firstName} ${proposal.student.lastName}`,
                text: `Please find attached the field letter for ${proposal.student.firstName} ${proposal.student.lastName}`,
                attachments: [{
                    filename: `field-letter-${proposal.student.firstName}-${proposal.student.lastName}.pdf`,
                    content: pdfBuffer
                }]
            });
        } catch (emailError) {
            console.error('Failed to send email:', emailError);
        }

        // Database transaction
        const updatedProposal = await prisma.$transaction(async (prisma) => {
            // Update student status
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: proposal.student.id,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });

            // Create letter to field status
            await prisma.studentStatus.create({
                data: {
                    student: { connect: { id: proposal.student.id } },
                    definition: { connect: { id: letterToFieldStatus.id } },
                    isCurrent: false,
                    startDate: new Date(),
                    endDate: new Date(),
                    updatedBy: { connect: { id: req.user.id } }
                }
            });

            // Create fieldwork status
            await prisma.studentStatus.create({
                data: {
                    student: { connect: { id: proposal.student.id } },
                    definition: { connect: { id: fieldworkStatus.id } },
                    isCurrent: true,
                    startDate: new Date(),
                    updatedBy: { connect: { id: req.user.id } }
                }
            });

            // Store the PDF file
            const pdfDoc = await prisma.letterDocument.create({
                data: {
                    name: `field-letter-${proposal.student.firstName}-${proposal.student.lastName}.pdf`,
                    type: 'FIELD_LETTER',
                    file: pdfBuffer,
                    proposal: { connect: { id: proposalId } },
                    uploadedBy: { connect: { id: req.user.id } }
                }
            });

            // Update proposal statuses
            await prisma.proposalStatus.updateMany({
                where: {
                    proposalId: proposalId,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });

            await prisma.proposalStatus.create({
                data: {
                    proposal: { connect: { id: proposalId } },
                    definition: { connect: { id: letterToFieldStatus.id } },
                    isCurrent: true,
                    startDate: new Date(),
                    endDate: new Date()
                }
            });

            // Update proposal
            return await prisma.proposal.update({
                where: { id: proposalId },
                data: {
                    fieldLetterDate: new Date(),
                }
            });
        });

        res.status(200).json({
            message: 'Field letter processed and sent successfully',
            proposal: updatedProposal
        });

    } catch (error) {
        console.error('Error in generateFieldLetter:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    } finally {
        PDFNet.shutdown();
    }
};

/**
 * Update field letter date for a proposal
 * @route PUT /api/v1/faculty/field-letter-date/:proposalId
 * @access Private (School Admin)
 */
export const updateFieldLetterDate = async (req, res, next) => {
    try {
        const { proposalId } = req.params;
        const { fieldLetterDate } = req.body;

        if (!fieldLetterDate) {
            const error = new Error('Field letter date is required');
            error.statusCode = 400;
            throw error;
        }

        // Validate date format
        const dateObj = new Date(fieldLetterDate);
        if (isNaN(dateObj.getTime())) {
            const error = new Error('Invalid date format');
            error.statusCode = 400;
            throw error;
        }

        // Check if proposal exists
        const proposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                student: true,
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        // Get letter to field status definition
        const letterToFieldStatus = await prisma.statusDefinition.findFirst({
            where: { name: 'letter to field issued' }
        });

        if (!letterToFieldStatus) {
            const error = new Error('Letter to field status definition not found');
            error.statusCode = 404;
            throw error;
        }

        // Get fieldwork status definition
        const fieldworkStatus = await prisma.statusDefinition.findFirst({
            where: { name: 'fieldwork' }
        });

        if (!fieldworkStatus) {
            const error = new Error('Fieldwork status definition not found');
            error.statusCode = 404;
            throw error;
        }

        // Update student status
        await prisma.studentStatus.updateMany({
            where: {
                studentId: proposal.student.id,
                isCurrent: true
            },
            data: {
                isCurrent: false,
                endDate: new Date()
            }
        });

        // Create letter to field status
        await prisma.studentStatus.create({
            data: {
                student: { connect: { id: proposal.student.id } },
                definition: { connect: { id: letterToFieldStatus.id } },
                isCurrent: false,
                startDate: new Date(),
                endDate: new Date(),
                updatedBy: { connect: { id: req.user.id } }
            }
        });

        // Create fieldwork status
        await prisma.studentStatus.create({
            data: {
                student: { connect: { id: proposal.student.id } },
                definition: { connect: { id: fieldworkStatus.id } },
                isCurrent: true,
                startDate: new Date(),
                updatedBy: { connect: { id: req.user.id } }
            }
        });

        // Update proposal statuses
        await prisma.proposalStatus.updateMany({
            where: {
                proposalId: proposalId,
                isCurrent: true
            },
            data: {
                isCurrent: false,
                endDate: new Date()
            }
        });

        await prisma.proposalStatus.create({
            data: {
                proposal: { connect: { id: proposalId } },
                definition: { connect: { id: letterToFieldStatus.id } },
                isCurrent: true,
                startDate: new Date(),
                endDate: new Date()
            }
        });

        // Update the field letter date
        const updatedProposal = await prisma.proposal.update({
            where: { id: proposalId },
            data: {
                fieldLetterDate: new Date(fieldLetterDate)
            }
        });

        res.status(200).json({
            message: 'Field letter date updated successfully',
            proposal: updatedProposal
        });

    } catch (error) {
        console.error('Error in updateFieldLetterDate:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

/** BOOK MANAGEMENT CONTROLLERS */
// Controller for submitting student book
export const submitStudentBook = async (req, res, next) => {
    try {
        const { studentId } = req.params;
        const { title, description, submissionDate, submissionCondition } = req.body;

        // Check if student exists
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                statuses: {
                    where: {
                        isCurrent: true
                    },
                    take: 1
                },
                books: true
            }
        });

        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if student already has a book
        if (student.books && student.books.length > 0) {
            const error = new Error('Student already has a submitted book');
            error.statusCode = 400;
            throw error;
        }

        // Find book submitted status definition
        const bookSubmittedStatus = await prisma.statusDefinition.findFirst({
            where: {
                name: "book submitted"
            }
        });

        if (!bookSubmittedStatus) {
            const error = new Error('Book submitted status definition not found');
            error.statusCode = 404;
            throw error;
        }

        // Get current year
        const currentYear = new Date().getFullYear();

        // Get the latest book code for this year
        const latestBook = await prisma.book.findFirst({
            where: {
                bookCode: {
                    startsWith: `BK-${currentYear}`
                }
            },
            orderBy: {
                bookCode: 'desc'
            }
        });

        let nextNumber = 1;
        if (latestBook) {
            // Extract the number from the latest book code and increment
            const lastNumber = parseInt(latestBook.bookCode.split('-')[2]);
            nextNumber = lastNumber + 1;
        }

        // Generate unique book code (BK-YYYY-XXXX where XXXX is padded with zeros)
        const bookCode = `BK-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

        // Create new book record
        const book = await prisma.book.create({
            data: {
                bookCode,
                title,
                description,
                submissionDate: new Date(submissionDate),
                submissionCondition,
                student: { connect: { id: studentId } },
                submittedBy: { connect: { id: req.user.id } }
            }
        });

        // Update current status to not be current
        if (student.statuses[0]) {
            await prisma.studentStatus.update({
                where: { id: student.statuses[0].id },
                data: { 
                    isCurrent: false,
                    endDate: new Date() 
                }
            });
        }

        // Create new student status for book submission
        await prisma.studentStatus.create({
            data: {
                student: { connect: { id: studentId } },
                definition: { connect: { id: bookSubmittedStatus.id } },
                startDate: new Date(),
                isCurrent: true,
                updatedBy: { connect: { id: req.user.id } }
            }
        });

        // Create initial book status
        await prisma.bookStatus.create({
            data: {
                book: { connect: { id: book.id } },
                definition: { connect: { id: bookSubmittedStatus.id } },
                startDate: new Date(),
                isActive: true,
                isCurrent: true
            }
        });

        res.status(201).json({
            message: 'Book submitted successfully',
            book
        });

    } catch (error) {
        console.error('Error in submitStudentBook:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


// Get student books
export const getStudentBooks = async (req, res, next) => {
    try {
        const { studentId } = req.params;

        const books = await prisma.book.findMany({
            where: { studentId },
            include: {
                statuses: {
                    include: {
                        definition: true
                    },
                    orderBy: {
                        updatedAt: 'desc'
                    }
                },
                examinerAssignments: {
                    include: {
                        examiner: {
                            select: {
                                id: true,
                                name: true,
                                primaryEmail: true,
                                type: true
                            }
                        }
                    }
                },
                vivaHistory: true,
                submittedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true
                    }
                }
            },
            orderBy: {
                submissionDate: 'desc'
            }
        });

        if (!books) {
            const error = new Error('Books not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            books
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Get all books
export const getAllBooks = async (req, res, next) => {
    try {
        const books = await prisma.book.findMany({
            include: {
                student: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                       
                    }
                },
                statuses: {
                    include: {
                        definition: true
                    },
                    orderBy: {
                        updatedAt: 'desc'
                    }
                },
                submittedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true
                    }
                },
               
            },
            orderBy: {
                submissionDate: 'desc'
            }
        });

        if (!books) {
            const error = new Error('No books found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            books
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

export const getBook = async (req, res, next) => {
    try {
        const { bookId } = req.params;

        console.log(bookId);

        const book = await prisma.book.findUnique({
            where: {
                id: bookId
            },
            include: {
                student: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                statuses: {
                    include: {
                        definition: true
                    },
                    orderBy: {
                        updatedAt: 'desc'
                    }
                },
                submittedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true
                    }
                },
                examinerAssignments: {
                    include: {
                        examiner: true
                    }
                }
            }
        });

        if (!book) {
            const error = new Error('Book not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            book
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for creating a new examiner
export const createExaminer = async (req, res, next) => {
    try {
        const { name, primaryEmail, secondaryEmail, primaryPhone, secondaryPhone, institution, type } = req.body;

        // Validate required fields
        if (!name || !primaryEmail || !institution || !type) {
            const error = new Error('Name, primary email, institution, and type are required fields');
            error.statusCode = 400;
            throw error;
        }

        // Check if examiner with the same primary email already exists
        const existingExaminer = await prisma.examiner.findUnique({
            where: {
                primaryEmail
            }
        });

        if (existingExaminer) {
            const error = new Error('An examiner with this primary email already exists');
            error.statusCode = 409;
            throw error;
        }

        // Create new examiner
        const newExaminer = await prisma.examiner.create({
            data: {
                name,
                primaryEmail,
                secondaryEmail,
                primaryPhone,
                secondaryPhone,
                institution,
                type
            }
        });

        res.status(201).json({
            message: 'Examiner created successfully',
            examiner: newExaminer
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for getting all examiners
export const getAllExaminers = async (req, res, next) => {
    try {
        const examiners = await prisma.examiner.findMany({
            include: {
                books: {
                    include: {
                        examinerAssignments: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.status(200).json({
            examiners
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for assigning examiners to a book
export const assignExaminersToBook = async (req, res, next) => {
    try {
        const { bookId } = req.params;
        const { examinerIds } = req.body;

        if (!bookId || !examinerIds || !Array.isArray(examinerIds) || examinerIds.length === 0) {
            const error = new Error('Book ID and at least one examiner ID are required');
            error.statusCode = 400;
            throw error;
        }

        // Check if book exists
        const book = await prisma.book.findUnique({
            where: {
                id: bookId
            },
           include: {
                student: true,
                statuses: {
                    where: {
                        isCurrent: true
                    },
                    include: {
                        definition: true
                    }
                }
            }
        });

        if (!book) {
            const error = new Error('Book not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if all examiners exist
        const examiners = await prisma.examiner.findMany({
            where: {
                id: {
                    in: examinerIds
                }
            }
        });

        if (examiners.length !== examinerIds.length) {
            const error = new Error('One or more examiners not found');
            error.statusCode = 404;
            throw error;
        }

        // Find the "Under Examination" status definition
        const underExaminationStatus = await prisma.statusDefinition.findFirst({
            where: {
                name: "under examination"
            }
        });

        if (!underExaminationStatus) {
            const error = new Error('Under Examination status definition not found');
            error.statusCode = 404;
            throw error;
        }

        // Get current date for assignment tracking
        const assignmentDate = new Date();

        // Update the book with the examiner IDs
        const updatedBook = await prisma.book.update({
            where: {
                id: bookId
            },
            data: {
                // examinerIds: examinerIds,
                examiners: {
                    connect: examinerIds.map(id => ({ id }))
                },
                // examinerAssignmentDate: assignmentDate // Add assignment date
            },
            include: {
                examiners: true,
                student: true
            }
        });

        // Update all current book statuses to not current
        await prisma.bookStatus.updateMany({
            where: {
                bookId: bookId,
                isCurrent: true
            },
            data: {
                isCurrent: false,
                isActive: false,
                endDate: new Date()
            }
        });

        // Create new book status "Under Examination"
        await prisma.bookStatus.create({
            data: {
                book: { connect: { id: bookId } },
                definition: { connect: { id: underExaminationStatus.id } },
                isActive: true,
                isCurrent: true,
                startDate: new Date(),
                
            }
        });

        // If student exists, update their status as well
        if (book.student) {
            // Update all current student statuses to not current
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: book.student.id,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    isActive: false,
                    endDate: new Date()
                }
            });

            // Create new student status "Under Examination"
            await prisma.studentStatus.create({
                data: {
                    student: { connect: { id: book.student.id } },
                    definition: { connect: { id: underExaminationStatus.id } },
                    isActive: true,
                    startDate: new Date(),
                    isCurrent: true,
                    updatedBy: { connect: { id: req.user.id } }
                }
            });
        }

          // Checkassignment if existing is external examiner
          // Check if there's an existing external examiner assignment
          const existingAssignment = await prisma.examinerBookAssignment.findFirst({
            where: {
              examiner: { type: "External" },
              bookId,
              isCurrent: true
            }
          });

          // Create assignments for each examiner
          for (const examinerId of examinerIds) {
            if (existingAssignment) {
              // Deactivate existing external examiner assignment
              await prisma.examinerBookAssignment.update({
                where: { id: existingAssignment.id },
                data: {
                  isCurrent: false,
                
                }
              });

              // Create new resubmission assignment
              await prisma.examinerBookAssignment.create({
                data: {
                  examiner: { connect: { id: examinerId } },
                  book: { connect: { id: bookId } },
                  assignedAt: assignmentDate,
                  submissionType: "Resubmission",
                  status: "Pending",
                  isCurrent: true
                }
              });
            } else {
              // Create new normal assignment
              await prisma.examinerBookAssignment.create({
                data: {
                  examiner: { connect: { id: examinerId } },
                  book: { connect: { id: bookId } },
                  assignedAt: assignmentDate,
                  submissionType: "Normal", 
                  status: "Pending",
                  isCurrent: true
                }
              });
            }
          }

        res.status(200).json({
            message: 'Examiners assigned to book successfully and status updated to Under Examination',
            book: updatedBook,
            assignmentDate: assignmentDate
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for getting a single examiner by ID
export const getExaminer = async (req, res, next) => {
    try {
        const { examinerId } = req.params;

        if (!examinerId) {
            const error = new Error('Examiner ID is required');
            error.statusCode = 400;
            throw error;
        }

        const examiner = await prisma.examiner.findUnique({
            where: {
                id: examinerId
            },
          include: {
                examinerBookAssignments: {
                    include: {
                        book: {
                            include: {
                                student: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        email: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!examiner) {
            const error = new Error('Examiner not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            message: 'Examiner retrieved successfully',
            examiner
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for updating examiner mark
export const updateExternalExaminerMark = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const { mark, comments } = req.body;

    if (!assignmentId) {
      const error = new Error("Assignment ID is required");
      error.statusCode = 400;
      throw error;
    }

    if (mark === undefined || mark === null) {
      const error = new Error("Mark is required");
      error.statusCode = 400;
      throw error;
    }

    if (!comments) {
      const error = new Error("Comments are required");
      error.statusCode = 400;
      throw error;
    }

    // Check if assignment exists
    const existingAssignment = await prisma.examinerBookAssignment.findUnique({
      where: {
        id: assignmentId,
      },
      include: {
        examiner: true,
        book: {
          include: {
            examinerAssignments: {
              include: {
                examiner: true,
              },
            },
          },
        },
      },
    });

    if (!existingAssignment) {
      const error = new Error("Assignment not found");
      error.statusCode = 404;
      throw error;
    }

    const parsedMark = parseFloat(mark);
    let status = null;
    let averageMark = parsedMark;

    // Check if examiner is external
    if (existingAssignment.examiner.type === "External") {
      // Check if there is an active internal examiner
      const internalExaminerAssignment =
        existingAssignment.book.examinerAssignments.find(
          (assignment) =>
            assignment.examiner.type === "Internal" &&
            assignment.grade !== null &&
            assignment.id !== assignmentId &&
            assignment.isCurrent === true
        );

        console.log("internalExaminerAssignment", internalExaminerAssignment);

      const student = await prisma.student.findUnique({
        where: {
          id: existingAssignment.book.studentId,
        },
      });

      const resubmissionRequiredStatus =
        await prisma.statusDefinition.findFirst({
          where: {
            name: "failed & resubmission required",
          },
        });

      if (!resubmissionRequiredStatus) {
        const error = new Error(
          "Resubmission required status definition not found"
        );
        error.statusCode = 404;
        throw error;
      }

      const passedStatus = await prisma.statusDefinition.findFirst({
        where: {
          name: "passed & authorized for viva",
        },
      });

      if (!passedStatus) {
        const error = new Error("Passed status definition not found");
        error.statusCode = 404;
        throw error;
      }

      // If mark is below 60%, status is failed
      if (parsedMark < 60) {
        status = "FAILED";
        if (internalExaminerAssignment) {
          averageMark = (parsedMark + internalExaminerAssignment.grade) / 2;

          // Update the book with the average mark
          await prisma.book.update({
            where: {
              id: existingAssignment.bookId,
            },
            data: {
              averageExamMark: averageMark,
            },
          });
        } else {
        }

        // Update the previous student status to not be current
        await prisma.studentStatus.updateMany({
          where: {
            studentId: student.id,
            isCurrent: true,
          },
          data: {
            isCurrent: false,
            endDate: new Date(),
          },
        });

        // Update the student status to indicate resubmission is required
        await prisma.studentStatus.create({
          data: {
            student: { connect: { id: student.id } },
            definition: { connect: { id: resubmissionRequiredStatus.id } },
            isActive: true,
            startDate: new Date(),
            isCurrent: true,
            updatedBy: { connect: { id: req.user.id } },
          },
        });

        // Update the previous book status to not be current
        await prisma.bookStatus.updateMany({
          where: {
            bookId: existingAssignment.bookId,
            isCurrent: true,
          },
          data: {
            isCurrent: false,
            endDate: new Date(),
          },
        });

        // Create new book status for resubmission
        await prisma.bookStatus.create({
          data: {
            book: { connect: { id: existingAssignment.bookId } },
            definition: { connect: { id: resubmissionRequiredStatus.id } },
            isActive: true,
            startDate: new Date(),
            isCurrent: true,
            // updatedBy: { connect: { id: req.user.id } },
          },
        });
      } else {
        status = "PASSED";
        // If internal examiner exists, calculate average
        if (internalExaminerAssignment) {
          averageMark = (parsedMark + internalExaminerAssignment.grade) / 2;

          // Update the book with the average mark
          await prisma.book.update({
            where: {
              id: existingAssignment.bookId,
            },
            data: {
              averageExamMark: averageMark,
            },
          });

          if (averageMark >= 60) {
            // Update the previous student status to not be current
            await prisma.studentStatus.updateMany({
              where: {
                studentId: student.id,
                isCurrent: true,
              },
              data: {
                isCurrent: false,
                endDate: new Date(),
              },
            });

            // Update the student status to indicate resubmission is required
            await prisma.studentStatus.create({
              data: {
                student: { connect: { id: student.id } },
                definition: { connect: { id: passedStatus.id } },
                isActive: true,
                startDate: new Date(),
                isCurrent: true,
                updatedBy: { connect: { id: req.user.id } },
              },
            });

            // Update the previous book status to not be current
            await prisma.bookStatus.updateMany({
              where: {
                bookId: existingAssignment.bookId,
                isCurrent: true,
              },
              data: {
                isCurrent: false,
                endDate: new Date(),
              },
            });

            // Create new book status for resubmission
            await prisma.bookStatus.create({
              data: {
                book: { connect: { id: existingAssignment.bookId } },
                definition: { connect: { id: passedStatus.id } },
                isActive: true,
                startDate: new Date(),
                isCurrent: true,
                // updatedBy: { connect: { id: req.user.id } },
              },
            });
          } else {
            // Update the previous student status to not be current
            await prisma.studentStatus.updateMany({
              where: {
                studentId: student.id,
                isCurrent: true,
              },
              data: {
                isCurrent: false,
                endDate: new Date(),
              },
            });

            // Update the student status to indicate resubmission is required
            await prisma.studentStatus.create({
              data: {
                student: { connect: { id: student.id } },
                definition: { connect: { id: resubmissionRequiredStatus.id } },
                isActive: true,
                startDate: new Date(),
                isCurrent: true,
                updatedBy: { connect: { id: req.user.id } },
              },
            });

            // Update the previous book status to not be current
            await prisma.bookStatus.updateMany({
              where: {
                bookId: existingAssignment.bookId,
                isCurrent: true,
              },
              data: {
                isCurrent: false,
                endDate: new Date(),
              },
            });

            // Create new book status for resubmission
            await prisma.bookStatus.create({
              data: {
                book: { connect: { id: existingAssignment.bookId } },
                definition: { connect: { id: resubmissionRequiredStatus.id } },
                isActive: true,
                startDate: new Date(),
                isCurrent: true,
                // updatedBy: { connect: { id: req.user.id } },
              },
            });
          }
        }
      }
    }

    // Update the assignment with mark, comments and status
    const updatedAssignment = await prisma.examinerBookAssignment.update({
      where: {
        id: assignmentId,
      },
      data: {
        grade: parsedMark,
        feedback: comments,
        reportSubmittedAt: new Date(),
        status: status,
      },
    });

    res.status(200).json({
      message: "Examiner mark updated successfully",
      assignment: updatedAssignment,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for updating an examiner
export const updateExaminer = async (req, res, next) => {
    try {
        const { examinerId } = req.params;
        const {
            name,
            primaryEmail,
            secondaryEmail,
            primaryPhone,
            secondaryPhone,
            type,
            title,
            designation,
            institution,
            address,
            specialization,
            campusId,
            schoolId,
            departmentId
        } = req.body;

        if (!examinerId) {
            const error = new Error('Examiner ID is required');
            error.statusCode = 400;
            throw error;
        }

        // Check if examiner exists
        const existingExaminer = await prisma.examiner.findUnique({
            where: {
                id: examinerId
            }
        });

        if (!existingExaminer) {
            const error = new Error('Examiner not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if email is already in use by another examiner
        if (primaryEmail && primaryEmail !== existingExaminer.primaryEmail) {
            const emailExists = await prisma.examiner.findUnique({
                where: {
                    primaryEmail
                }
            });

            if (emailExists) {
                const error = new Error('Email is already in use by another examiner');
                error.statusCode = 400;
                throw error;
            }
        }

        // Update examiner
        const updatedExaminer = await prisma.examiner.update({
            where: {
                id: examinerId
            },
            data: {
                name,
                primaryEmail,
                secondaryEmail,
                primaryPhone,
                secondaryPhone,
                type,
                title,
                designation,
                institution,
                address,
                specialization,
                campusId,
                schoolId,
                departmentId
            }
        });

        res.status(200).json({
            message: 'Examiner updated successfully',
            examiner: updatedExaminer
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for deleting an examiner
export const deleteExaminer = async (req, res, next) => {
    try {
        const { examinerId } = req.params;

        if (!examinerId) {
            const error = new Error('Examiner ID is required');
            error.statusCode = 400;
            throw error;
        }

        // Check if examiner exists
        const examiner = await prisma.examiner.findUnique({
            where: {
                id: examinerId
            },
            include: {
                books: true
            }
        });

        if (!examiner) {
            const error = new Error('Examiner not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if examiner is assigned to any books
        if (examiner.books && examiner.books.length > 0) {
            const error = new Error('Cannot delete examiner as they are assigned to one or more books');
            error.statusCode = 400;
            throw error;
        }

        // Delete examiner
        await prisma.examiner.delete({
            where: {
                id: examinerId
            }
        });

        res.status(200).json({
            message: 'Examiner deleted successfully'
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

/*** USER CONTROLLERS */

// Create a new user
export const createUser = async (req, res, next) => {
    try {
        const { 
            name, 
            email, 
            role, 
            password, 
            title, 
            phone, 
            designation, 
            campus 
        } = req.body;

        // Validate required fields
        if (!name || !email || !role || !password) {
            const error = new Error('Name, email, role, and password are required');
            error.statusCode = 400;
            throw error;
        }

        // Check if user with email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            const error = new Error('User with this email already exists');
            error.statusCode = 409;
            throw error;
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create the new user
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                role,
                password: hashedPassword,
                title,
                phone,
                designation,
                campus: { connect: { id: campus } }
            }
        });

        // Remove password from response
        const { password: _, ...userWithoutPassword } = newUser;

        res.status(201).json({
            message: 'User created successfully',
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Error in createUser:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Get all users except the logged in user
export const getAllUsers = async (req, res, next) => {
    try {
        const loggedInUserId = req.user.id;

        const users = await prisma.user.findMany({
            where: {
                id: {
                    not: loggedInUserId
                },
                role: {
                    in: ['SUPERADMIN', 'RESEARCH_ADMIN', 'MANAGER', 'REGISTRY_ADMIN']
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                title: true,
                phone: true,
                designation: true,
                campus: true,
                isActive: true,
                createdAt: true,
                updatedAt: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.status(200).json({
            users
        });

    } catch (error) {
        console.error('Error in getAllUsers:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


// Deactivate user
export const deactivateUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        console.log(userId);

        if (!userId) {
            const error = new Error('User ID is required');
            error.statusCode = 400;
            throw error;
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!existingUser) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Update user to deactivated status
        const deactivatedUser = await prisma.user.update({
            where: { id: userId },
            data: { 
                isActive: false,
                deactivatedAt: new Date(),
                deactivatedBy: req.user ? { connect: { id: req.user.id } } : undefined
            }
        });

        // Remove password from response
        const { password: _, ...userWithoutPassword } = deactivatedUser;

        res.status(200).json({
            message: 'User deactivated successfully',
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Error in deactivateUser:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Reactivate user
export const reactivateUser = async (req, res, next) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            const error = new Error('User ID is required');
            error.statusCode = 400;
            throw error;
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!existingUser) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Update user to activated status
        const reactivatedUser = await prisma.user.update({
            where: { id: userId },
            data: { 
                isActive: true,
                deactivatedAt: null,
                reactivatedAt: new Date(),
                reactivatedBy: req.user ? { connect: { id: req.user.id } } : undefined
            }
        });

        // Remove password from response
        const { password: _, ...userWithoutPassword } = reactivatedUser;

        res.status(200).json({
            message: 'User reactivated successfully',
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Error in reactivateUser:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Update user
export const updateUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { name, email, phone, designation, role, campusId } = req.body;

        if (!userId) {
            const error = new Error('User ID is required');
            error.statusCode = 400;
            throw error;
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!existingUser) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Prepare update data
        const updateData = {};
        const changes = {};
        
        if (name && name !== existingUser.name) {
            updateData.name = name;
            changes.oldName = existingUser.name;
            changes.newName = name;
        } else if (name) {
            updateData.name = name;
        }
        
        if (email && email !== existingUser.email) {
            updateData.email = email;
            changes.oldEmail = existingUser.email;
            changes.newEmail = email;
        } else if (email) {
            updateData.email = email;
        }
        
        if (phone && phone !== existingUser.phone) {
            updateData.phone = phone;
            changes.oldPhone = existingUser.phone;
            changes.newPhone = phone;
        } else if (phone) {
            updateData.phone = phone;
        }
        
        if (designation && designation !== existingUser.designation) {
            updateData.designation = designation;
            changes.oldDesignation = existingUser.designation;
            changes.newDesignation = designation;
        } else if (designation) {
            updateData.designation = designation;
        }
        
        // if (role && role !== existingUser.role) {
        //     updateData.role = role;
        //     changes.push({ field: 'role', oldValue: existingUser.role, newValue: role });
        // } else if (role) {
        //     updateData.role = role;
        // }
        
    
        
        // Handle campus connection/disconnection
        // if (campusId) {
        //     updateData.campus = { connect: { id: campusId } };
        // } else if (campusId === null) {
        //     updateData.campus = { disconnect: true };
        // }

        // Update user
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData
        });

        // Remove password from response
        const { password: _, ...userWithoutPassword } = updatedUser;

          // Store changes in the update data if there are any
          if (Object.keys(changes).length > 0) {
            // Log activity
       await prisma.userActivity.create({
           data: {
               userId: req.user.id,
               action: `Updated user: ${existingUser.name}`,
               entityType: 'user',
               entityId: userId,
               details: JSON.stringify(changes)
           }
       });
       }

        res.status(200).json({
            message: 'User updated successfully',
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Error in updateUser:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Get user details with activities
export const getUser = async (req, res, next) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            const error = new Error('User ID is required');
            error.statusCode = 400;
            throw error;
        }

        // Fetch user with campus information
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                campus: true
            }
        });

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Fetch user activities
        const activities = await prisma.userActivity.findMany({
            where: { userId },
            
            orderBy: { timestamp: 'desc' }
        });

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        res.status(200).json({
            message: 'User retrieved successfully',
            user: userWithoutPassword,
            activities
        });

    } catch (error) {
        console.error('Error in getUser:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


// Delete user
export const deleteUser = async (req, res, next) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            const error = new Error('User ID is required');
            error.statusCode = 400;
            throw error;
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!existingUser) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Delete user
        await prisma.user.delete({
            where: { id: userId }
        });

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Deleted user: ${existingUser.name}`,
                entityType: 'user',
                entityId: userId,
                details: JSON.stringify({
                    name: existingUser.name,
                    email: existingUser.email,
                    phone: existingUser.phone,
                    designation: existingUser.designation
                })
            }
        });

        res.status(200).json({
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Error in deleteUser:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Update user password
export const updateUserPassword = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { newPassword } = req.body;

        if (!userId) {
            const error = new Error('User ID is required');
            error.statusCode = 400;
            throw error;
        }

        if (!newPassword) {
            const error = new Error('New password is required');
            error.statusCode = 400;
            throw error;
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!existingUser) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update user password
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Updated password for user: ${existingUser.name}`
            }
        });

        res.status(200).json({
            message: 'User password updated successfully'
        });

    } catch (error) {
        console.error('Error in updateUserPassword:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


/** should be deleted */
// Add panelists to a book
export const addPanelistsToBook = async (req, res, next) => {
    try {
        const { bookId } = req.params;
        const { panelists } = req.body;

        // Validate input
        if (!bookId) {
            const error = new Error('Book ID is required');
            error.statusCode = 400;
            throw error;
        }

        if (!panelists || !Array.isArray(panelists) || panelists.length === 0) {
            const error = new Error('At least one panelist is required');
            error.statusCode = 400;
            throw error;
        }

        // Validate panelist objects
        for (const panelist of panelists) {
            if (!panelist.name || !panelist.email) {
                const error = new Error('Each panelist must have name and email');
                error.statusCode = 400;
                throw error;
            }
        }

        // Check if book exists
        const existingBook = await prisma.book.findUnique({
            where: { id: bookId },
            include: {
                panelists: true,
                student: true
            }
        });

        if (!existingBook) {
            const error = new Error('Book not found');
            error.statusCode = 404;
            throw error;
        }

        // Get user's campus
        const faculty = await prisma.facultyMember.findUnique({
            where: { userId: req.user.id },
            select: { campusId: true }
        });

        if (!faculty || !faculty.campusId) {
            const error = new Error('Faculty campus not found');
            error.statusCode = 404;
            throw error;
        }

        // Process each panelist
        const panelistsToAdd = [];
        for (const panelist of panelists) {
            // Check if panelist already exists
            let existingPanelist = await prisma.panelist.findFirst({
                where: {
                    email: panelist.email,
                    campusId: faculty.campusId
                }
            });

            // Create panelist if doesn't exist
            if (!existingPanelist) {
                existingPanelist = await prisma.panelist.create({
                    data: {
                        name: panelist.name,
                        email: panelist.email,
                        campus: {
                            connect: { id: faculty.campusId }
                        }
                    }
                });
            }

            // Check if panelist is already assigned to this book
            const alreadyAssigned = existingBook.panelists.some(p => p.id === existingPanelist.id);
            if (!alreadyAssigned) {
                panelistsToAdd.push(existingPanelist.id);
            }
        }

        // Add panelists to book
        if (panelistsToAdd.length > 0) {
            await prisma.book.update({
                where: { id: bookId },
                data: {
                    panelists: {
                        connect: panelistsToAdd.map(id => ({ id }))
                    }
                }
            });
        } else {
            return res.status(200).json({
                message: 'All panelists are already assigned to this book',
                book: existingBook
            });
        }

        // Get updated book with panelists
        const updatedBook = await prisma.book.findUnique({
            where: { id: bookId },
            include: {
                panelists: true,
                student: true
            }
        });

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Added ${panelistsToAdd.length} panelists to book: ${existingBook.title || `Book for ${existingBook.student?.name || 'Unknown Student'}`}`,
                entityId: updatedBook.id,
                entityType: "Student Book"
            }
        });

        res.status(200).json({
            message: 'Panelists added to book successfully',
            book: updatedBook
        });

    } catch (error) {
        console.error('Error in addPanelistsToBook:', error);
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
/** PROPOSAL DEFENSE CONTROLLERS */
// Controller for scheduling a proposal defense
export const scheduleProposalDefense = async (req, res, next) => {
    try {
        const { proposalId } = req.params;
        const { scheduledDate, panelistIds } = req.body;

        // Validate inputs
        if (!proposalId || !scheduledDate || !panelistIds || !Array.isArray(panelistIds) || panelistIds.length === 0) {
            const error = new Error('Proposal ID, scheduled date, and at least one panelist are required');
            error.statusCode = 400;
            throw error;
        }

        // Check if proposal exists
        const existingProposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                student: true,
                statuses: {
                    include: {
                        definition: true
                    }
                }
            }
        });

        if (!existingProposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if panelists exist
        const panelists = await prisma.panelist.findMany({
            where: {
                id: {
                    in: panelistIds
                }
            }
        });

        if (panelists.length !== panelistIds.length) {
            const error = new Error('One or more panelists not found');
            error.statusCode = 404;
            throw error;
        }

        // Get the current attempt number
        const currentDefenses = await prisma.proposalDefense.findMany({
            where: {
                proposalId: proposalId
            },
            orderBy: {
                attempt: 'desc'
            },
            take: 1
        });

        const attemptNumber = currentDefenses.length > 0 ? currentDefenses[0].attempt + 1 : 1;

        // If there's a current defense, mark it as not current
        if (currentDefenses.length > 0 && currentDefenses[0].isCurrent) {
            await prisma.proposalDefense.update({
                where: { id: currentDefenses[0].id },
                data: { isCurrent: false }
            });
        }

        // Create new proposal defense
        const proposalDefense = await prisma.proposalDefense.create({
            data: {
                proposal: { connect: { id: proposalId } },
                scheduledDate: new Date(scheduledDate),
                status: 'SCHEDULED',
                attempt: attemptNumber,
                panelists: {
                    connect: panelistIds.map(id => ({ id }))
                },
                isCurrent: true
            },
            include: {
                panelists: true,
                proposal: {
                    include: {
                        student: true
                    }
                }
            }
        });

        // Update the proposal with the defense ID
        // await prisma.proposal.update({
        //     where: { id: proposalId },
        //     data: {
        //         proposalDefenseIds: {
        //             push: proposalDefense.id
        //         }
        //     }
        // });

        // Find the status definition for "waiting for proposal defense"
        const waitingForDefenseStatus = await prisma.statusDefinition.findFirst({
            where: {
                name: "waiting for proposal defense"
            }
        });

        if (waitingForDefenseStatus) {
            // Set all current proposal statuses to not current
            await prisma.proposalStatus.updateMany({
                where: { 
                    proposalId: proposalId,
                    isCurrent: true 
                },
                data: { 
                    isCurrent: false, 
                    endDate: new Date() 
                }
            });

            // Create new proposal status
            await prisma.proposalStatus.create({
                data: {
                    proposal: { connect: { id: proposalId } },
                    definition: { connect: { id: waitingForDefenseStatus.id } },
                    startDate: new Date(),
                    isActive: true,
                    isCurrent: true
                }
            });

            // Update student status as well
            // First, set all current student statuses to not current
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: existingProposal.student.id,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });

            // Create new student status with the same definition
            await prisma.studentStatus.create({
                data: {
                    student: { connect: { id: existingProposal.student.id } },
                    definition: { connect: { id: waitingForDefenseStatus.id } },
                    startDate: new Date(),
                    isActive: true,
                    isCurrent: true,
                    updatedBy: { connect: { id: req.user.id } }
                }
            });
        }

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Scheduled proposal defense for ${existingProposal.student?.firstName || 'Unknown Student'} ${existingProposal.student?.lastName || ''}`,
                entityId: proposalDefense.id,
                entityType: "Proposal Defense"
            }
        });

        res.status(201).json({
            message: 'Proposal defense scheduled successfully',
            proposalDefense: proposalDefense
        });

    } catch (error) {
        console.error('Error in scheduleProposalDefense:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for recording proposal defense verdict
export const recordProposalDefenseVerdict = async (req, res, next) => {
    try {
        const { defenseId } = req.params;
        const { verdict, comments } = req.body;

        // Validate inputs
        if (!defenseId || !verdict) {
            const error = new Error('Defense ID and verdict are required');
            error.statusCode = 400;
            throw error;
        }

        // Check if defense exists
        const existingDefense = await prisma.proposalDefense.findUnique({
            where: { id: defenseId },
            include: { 
                proposal: {
                    include: {
                        student: true
                    }
                }
            }
        });

        if (!existingDefense) {
            const error = new Error('Proposal defense not found');
            error.statusCode = 404;
            throw error;
        }

        // Determine defense status based on verdict
        let defenseStatus;
        switch (verdict) {
            case 'PASS':
            case 'PASS_WITH_MINOR_CORRECTIONS':
            case 'PASS_WITH_MAJOR_CORRECTIONS':
                defenseStatus = 'COMPLETED';
                break;
            case 'FAIL':
                defenseStatus = 'FAILED';
                break;
            case 'RESCHEDULE':
                defenseStatus = 'RESCHEDULED';
                break;
            default:
                defenseStatus = 'COMPLETED';
        }

        // Update the defense with verdict and status
        const updatedDefense = await prisma.proposalDefense.update({
            where: { id: defenseId },
            data: {
                verdict: verdict,
                comments: comments,
                status: defenseStatus,
                completedAt: new Date()
            },
            include: {
                panelists: true,
                proposal: {
                    include: {
                        student: true
                    }
                }
            }
        });

        // If defense status is completed, update proposal and student status
        if (defenseStatus === 'COMPLETED' || defenseStatus === 'FAILED') {
            // Get appropriate status definition based on verdict
            const statusDefinitionName = defenseStatus === 'COMPLETED' ? 'passed-proposal graded' : 'failed-proposal graded';
            
            const statusDefinition = await prisma.statusDefinition.findFirst({
                where: { name: statusDefinitionName }
            });

            if (!statusDefinition) {
                const error = new Error(`Status definition "${statusDefinitionName}" not found`);
                error.statusCode = 500;
                throw error;
            }

            // Update proposal status
            await prisma.proposalStatus.updateMany({
                where: {
                    proposalId: existingDefense.proposal.id,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });

            // Create new proposal status
            await prisma.proposalStatus.create({
                data: {
                    proposal: { connect: { id: existingDefense.proposal.id } },
                    definition: { connect: { id: statusDefinition.id } },
                    isCurrent: true,
                    startDate: new Date()
                }
            });

            // Update student status if student exists
            if (existingDefense.proposal.student) {
                await prisma.studentStatus.updateMany({
                    where: {
                        studentId: existingDefense.proposal.student.id,
                        isCurrent: true
                    },
                    data: {
                        isCurrent: false,
                        endDate: new Date()
                    }
                });

                await prisma.studentStatus.create({
                    data: {
                        student: { connect: { id: existingDefense.proposal.student.id } },
                        definition: { connect: { id: statusDefinition.id } },
                        isCurrent: true,
                        startDate: new Date(),
                        isActive: true,
                        updatedBy: { connect: { id: req.user.id } }
                    }
                });
            }
        }

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Recorded proposal defense verdict (${verdict}) for ${existingDefense.proposal.student?.firstName || 'Unknown Student'} ${existingDefense.proposal.student?.lastName || ''}`,
                entityId: updatedDefense.id,
                entityType: "Proposal Defense"
            }
        });

        res.status(200).json({
            message: 'Proposal defense verdict recorded successfully',
            proposalDefense: updatedDefense
        });

    } catch (error) {
        console.error('Error in recordProposalDefenseVerdict:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller to get all proposal defenses
export const getProposalDefenses = async (req, res, next) => {
    try {
        const proposalDefenses = await prisma.proposalDefense.findMany({
            include: {
                proposal: {
                    include: {
                        student: true
                    }
                },
                panelists: true
            },
            orderBy: {
                scheduledDate: 'desc'
            }
        });

        res.status(200).json({
            message: 'Proposal defenses retrieved successfully',
            proposalDefenses: proposalDefenses
        });

    } catch (error) {
        console.error('Error in getProposalDefenses:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


/*** VIVA CONTROLLERS */
// Controller for recording viva verdict
export const recordVivaVerdict = async (req, res, next) => {
    try {
        const { vivaId } = req.params;
        const { verdict, comments } = req.body;

        // Validate inputs
        if (!vivaId || !verdict) {
            const error = new Error('Viva ID and verdict are required');
            error.statusCode = 400;
            throw error;
        }

        // Check if viva exists
        const existingViva = await prisma.viva.findUnique({
            where: { id: vivaId },
            include: { 
                book: {
                    include: {
                        student: true
                    }
                }
            }
        });

        if (!existingViva) {
            const error = new Error('Viva not found');
            error.statusCode = 404;
            throw error;
        }

        // Determine viva status based on verdict
        let vivaStatus;
        switch (verdict) {
            case 'PASS':
            case 'PASS_WITH_MINOR_CORRECTIONS':
            case 'PASS_WITH_MAJOR_CORRECTIONS':
                vivaStatus = 'COMPLETED';
                break;
            case 'FAIL':
                vivaStatus = 'FAILED';
                break;
            case 'RESCHEDULE':
                vivaStatus = 'RESCHEDULED';
                break;
            default:
                vivaStatus = 'COMPLETED';
        }

        // Update viva with verdict
        const updatedViva = await prisma.viva.update({
            where: { id: vivaId },
            data: {
                verdict,
                comments,
                status: vivaStatus,
                completedAt: new Date()
            },
            include: {
                book: {
                    include: {
                        student: true
                    }
                },
                panelists: true
            }
        });

        // Update student and book status if passed
        if (verdict === 'PASS' || verdict === 'PASS_WITH_MINOR_CORRECTIONS' || verdict === 'PASS_WITH_MAJOR_CORRECTIONS') {
            // Find status definition for minutes pending
            const minutesPendingStatus = await prisma.statusDefinition.findFirst({
                where: { name: 'minutes pending' }
            });

            if (minutesPendingStatus) {
                // First, update all current statuses to not current
                await prisma.studentStatus.updateMany({
                    where: {
                        studentId: existingViva.book.student.id,
                        isCurrent: true
                    },
                    data: {
                        isCurrent: false,
                        endDate: new Date()
                    }
                });
                
                // Update student status
                await prisma.studentStatus.create({
                    data: {
                        student: {connect: {id: existingViva.book.student.id}},
                        definition: {connect: {id: minutesPendingStatus.id}},
                        startDate: new Date(),
                        isCurrent: true
                    }
                });

                // First, update all current book statuses to not current
                await prisma.bookStatus.updateMany({
                    where: {
                        bookId: existingViva.bookId,
                        isCurrent: true
                    },
                    data: {
                        isCurrent: false,
                        endDate: new Date()
                    }
                });
                
                // Create new book status
                await prisma.bookStatus.create({
                    data: {
                        book: {connect: {id: existingViva.bookId}},
                        definition: {connect: {id: minutesPendingStatus.id}},
                        startDate: new Date(),
                        isCurrent: true
                    }
                });
            }
        }

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Recorded viva verdict: ${verdict} for ${existingViva.book?.title || `Book ID: ${existingViva.bookId}`}`,
                entityId: existingViva.bookId,
                entityType: "Student Book"
            }
        });

        res.status(200).json({
            message: 'Viva verdict recorded successfully',
            viva: updatedViva
        });

    } catch (error) {
        console.error('Error in recordVivaVerdict:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for scheduling viva
export const scheduleViva = async (req, res, next) => {
    try {
        const { bookId } = req.params;
        const { date, panelists, attempt, location, startTime, endTime } = req.body;

        // Validate inputs
        if (!bookId || !date || !panelists || panelists.length === 0) {
            const error = new Error('Book ID, date, and at least one panelist are required');
            error.statusCode = 400;
            throw error;
        }

        // Check if book exists
        const existingBook = await prisma.book.findUnique({
            where: { id: bookId },
            include: { student: true }
        });

        if (!existingBook) {
            const error = new Error('Book not found');
            error.statusCode = 404;
            throw error;
        }

        // Find status definition for viva scheduled
        const statusDefinition = await prisma.statusDefinition.findFirst({
            where: { name: 'scheduled for viva' }
        });

        // Set any existing vivas for this book to not current
        await prisma.viva.updateMany({
            where: { 
                bookId: bookId,
                isCurrent: true 
            },
            data: { isCurrent: false }
        });

        // Create new viva
        const newViva = await prisma.viva.create({
            data: {
                bookId,
                scheduledDate: new Date(date),
                status: 'SCHEDULED',
                attempt: attempt || 1,
                isCurrent: true,
                // location: location || 'To be announced',
                // startTime: startTime || null,
                // endTime: endTime || null,
                panelists: {
                    connect: panelists.map(id => ({ id }))
                }
            },
            include: {
                book: {
                    include: {
                        student: true
                    }
                },
                panelists: true
            }
        });

        // Update book status
        if (statusDefinition) {
            // Set all current book statuses to not current
            await prisma.bookStatus.updateMany({
                where: { 
                    bookId: bookId,
                    isCurrent: true 
                },
                data: { isCurrent: false, endDate: new Date() }
            });

            // Create new book status
            await prisma.bookStatus.create({
                data: {
                    book: { connect: { id: bookId } },
                    definition: { connect: { id: statusDefinition.id } },
                    startDate: new Date(),
                    isActive: true,
                    isCurrent: true
                }
            });

            // Update student status if needed
            if (existingBook.student) {
                // Set all current student statuses to not current
                await prisma.studentStatus.updateMany({
                    where: { 
                        studentId: existingBook.student.id,
                        isCurrent: true 
                    },
                    data: { isCurrent: false, endDate: new Date() }
                });

                // Create new student status
                await prisma.studentStatus.create({
                    data: {
                        student: { connect: { id: existingBook.student.id } },
                        definition: { connect: { id: statusDefinition.id } },
                        startDate: new Date(),
                        isActive: true,
                        isCurrent: true
                    }
                });
            }
        }

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Scheduled viva for ${existingBook.title || `Book for ${existingBook.student?.name || 'Unknown Student'}`}`,
                entityId: bookId,
                entityType: "Student Book"
            }
        });

        res.status(201).json({
            message: 'Viva scheduled successfully',
            viva: newViva
        });

    } catch (error) {
        console.error('Error in scheduleViva:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for adding a new panelist
export const addNewPanelist = async (req, res, next) => {
    try {
       
        const { name, email, institution } = req.body;

        // Validate inputs
        if (!name || !email) {
            const error = new Error('Name and email are required');
            error.statusCode = 400;
            throw error;
        }

        // Check if panelist already exists
        const existingPanelist = await prisma.panelist.findUnique({
            where: { email }
        });

        if (existingPanelist) {
            const error = new Error('Panelist with this email already exists');
            error.statusCode = 400;
            throw error;
        }

        // Create new panelist
        const newPanelist = await prisma.panelist.create({
            data: {
                name,
                email,
                institution
            }
        });

        res.status(201).json({
            message: 'Panelist added successfully',
            panelist: newPanelist
        });

    } catch (error) {
        console.error('Error in addNewPanelist:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for getting all panelists
export const getAllPanelists = async (req, res, next) => {
    try {
        const panelists = await prisma.panelist.findMany();
        res.status(200).json({
            message: 'Panelists fetched successfully',  
            panelists
        });
    } catch (error) {
        console.error('Error in getAllPanelists:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for getting all vivas for a specific book
export const getBookVivas = async (req, res, next) => {
    try {
        const { bookId } = req.params;

        if (!bookId) {
            const error = new Error('Book ID is required');
            error.statusCode = 400;
            throw error;
        }

        // Fetch all vivas for the specified book with related panelists
        const vivas = await prisma.viva.findMany({
            where: {
                bookId
            },
            include: {
                panelists: true
            },
            orderBy: {
                scheduledDate: 'desc'
            }
        });

        res.status(200).json({
            message: 'Book vivas fetched successfully',
            vivas
        });
    } catch (error) {
        console.error('Error in getBookVivas:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


// Controller for updating minutes sent date for a book
export const updateMinutesSentDate = async (req, res, next) => {
    try {
        const { bookId } = req.params;
        const { minutesSentDate } = req.body;

        if (!bookId) {
            const error = new Error('Book ID is required');
            error.statusCode = 400;
            throw error;
        }

        if (!minutesSentDate) {
            const error = new Error('Minutes sent date is required');
            error.statusCode = 400;
            throw error;
        }

        // Check if book exists
        const existingBook = await prisma.book.findUnique({
            where: { id: bookId },
            include: {
                student: true
            }
        });

        if (!existingBook) {
            const error = new Error('Book not found');
            error.statusCode = 404;
            throw error;
        }

        // Update book with minutes sent date
        const updatedBook = await prisma.book.update({
            where: { id: bookId },
            data: {
                minutesSentDate: new Date(minutesSentDate)
            },
            include: {
                student: true
            }
        });

        // Find status definition for minutes sent
        const minutesSentStatus = await prisma.statusDefinition.findFirst({
            where: { name: 'minutes sent' }
        });

        if (minutesSentStatus) {
            // First, update all current statuses to not current for student
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: existingBook.student.id,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });
            
            // Update student status
            await prisma.studentStatus.create({
                data: {
                    student: {connect: {id: existingBook.student.id}},
                    definition: {connect: {id: minutesSentStatus.id}},
                    startDate: new Date(),
                    isCurrent: true
                }
            });

            // First, update all current book statuses to not current
            await prisma.bookStatus.updateMany({
                where: {
                    bookId: bookId,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });
            
            // Create new book status
            await prisma.bookStatus.create({
                data: {
                    book: {connect: {id: bookId}},
                    definition: {connect: {id: minutesSentStatus.id}},
                    startDate: new Date(),
                    isCurrent: true
                }
            });
        }

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Updated minutes sent date to ${new Date(minutesSentDate).toISOString().split('T')[0]} for book: ${existingBook.title || `Book for ${existingBook.student?.firstName || 'Unknown Student'}`}`,
                entityId: updatedBook.id,
                entityType: "Student Book"
            }
        });

        res.status(200).json({
            message: 'Minutes sent date updated successfully',
            book: updatedBook
        });

    } catch (error) {
        console.error('Error in updateMinutesSentDate:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for updating compliance report date for a book
export const updateComplianceReportDate = async (req, res, next) => {
    try {
        const { bookId } = req.params;
        const { complianceReportDate } = req.body;

        if (!bookId) {
            const error = new Error('Book ID is required');
            error.statusCode = 400;
            throw error;
        }

        if (!complianceReportDate) {
            const error = new Error('Compliance report date is required');
            error.statusCode = 400;
            throw error;
        }

        // Check if book exists
        const existingBook = await prisma.book.findUnique({
            where: { id: bookId },
            include: {
                student: true
            }
        });

        if (!existingBook) {
            const error = new Error('Book not found');
            error.statusCode = 404;
            throw error;
        }

        // Update book with compliance report date
        const updatedBook = await prisma.book.update({
            where: { id: bookId },
            data: {
                complianceReportDate: new Date(complianceReportDate)
            },
            include: {
                student: true
            }
        });

        // Find status definition for final book & compliance report received
        const finalBookStatus = await prisma.statusDefinition.findFirst({
            where: { name: 'final book & compliance report received' }
        });

        if (finalBookStatus) {
            // First, update all current statuses to not current for student
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: existingBook.student.id,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });
            
            // Update student status
            await prisma.studentStatus.create({
                data: {
                    student: {connect: {id: existingBook.student.id}},
                    definition: {connect: {id: finalBookStatus.id}},
                    startDate: new Date(),
                    isCurrent: true
                }
            });

            // First, update all current book statuses to not current
            await prisma.bookStatus.updateMany({
                where: {
                    bookId: bookId,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });
            
            // Create new book status
            await prisma.bookStatus.create({
                data: {
                    book: {connect: {id: bookId}},
                    definition: {connect: {id: finalBookStatus.id}},
                    startDate: new Date(),
                    endDate: new Date(),
                    isCurrent: true
                }
            });
        }

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Updated compliance report date to ${new Date(complianceReportDate).toISOString().split('T')[0]} for book: ${existingBook.title || `Book for ${existingBook.student?.firstName || 'Unknown Student'}`}`,
                entityId: updatedBook.id,
                entityType: "Student Book"
            }
        });

        res.status(200).json({
            message: 'Compliance report date updated successfully',
            book: updatedBook
        });

    } catch (error) {
        console.error('Error in updateComplianceReportDate:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for updating results approval date
export const updateResultsApprovalDate = async (req, res, next) => {
    try {
        const {studentId} = req.params;
        const { resultsApprovedDate } = req.body;

        if (!studentId || !resultsApprovedDate) {
            const error = new Error('Student ID and results approval date are required');
            error.statusCode = 400;
            throw error;
        }

        // Check if student exists
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                statuses: {
                    where: { isCurrent: true },
                    include: { definition: true }
                }
            }
        });

        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        // Update the student with the results approval date
        const updatedStudent = await prisma.student.update({
            where: { id: studentId },
            data: {
                resultsApprovedDate: new Date(resultsApprovedDate)
            }
        });

        // Check if we need to update student status
        const currentStatus = student.statuses[0];
        
        // Find the "Results Approved" status definition
        const resultsApprovedStatus = await prisma.statusDefinition.findFirst({
            where: {
                name: "results approved",
            }
        });

        if (resultsApprovedStatus && (!currentStatus || currentStatus.definition.name !== "results approved")) {
            // First, update all current statuses to not current
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: studentId,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });
            
            // Create new student status
            await prisma.studentStatus.create({
                data: {
                    student: { connect: { id: studentId } },
                    definition: { connect: { id: resultsApprovedStatus.id } },
                    startDate: new Date(),
                    isCurrent: true
                }
            });
        }

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Updated results approval date to ${new Date(resultsApprovedDate).toISOString().split('T')[0]} for student: ${student.firstName} ${student.lastName}`,
                entityId: studentId,
                entityType: "Student"
            }
        });

        res.status(200).json({
            message: 'Results approval date updated successfully',
            student: updatedStudent
        });

    } catch (error) {
        console.error('Error in updateResultsApprovalDate:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for updating results sent date
export const updateResultsSentDate = async (req, res, next) => {
    try {
        const { studentId } = req.params;
        const { resultsSentDate } = req.body;

        if (!studentId || !resultsSentDate) {
            const error = new Error('Student ID and results sent date are required');
            error.statusCode = 400;
            throw error;
        }

        // Check if student exists
        const student = await prisma.student.findUnique({
            where: { id: studentId }
        });

        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        // Update the student with the results sent date
        const updatedStudent = await prisma.student.update({
            where: { id: studentId },
            data: {
                resultsSentDate: new Date(resultsSentDate)
            }
        });

        // Find the "results sent to schools" status definition
        const resultsSentStatus = await prisma.statusDefinition.findFirst({
            where: {
                name: "results sent to schools"
            }
        });

        // Get current status
        const currentStatus = await prisma.studentStatus.findFirst({
            where: {
                studentId: studentId,
                isCurrent: true
            },
            include: {
                definition: true
            }
        });

        // Update student status if the status definition exists and it's not already the current status
        if (resultsSentStatus && (!currentStatus || currentStatus.definition.name !== "results sent")) {
            // First, update all current statuses to not current
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: studentId,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });
            
            // Create new student status
            await prisma.studentStatus.create({
                data: {
                    student: { connect: { id: studentId } },
                    definition: { connect: { id: resultsSentStatus.id } },
                    startDate: new Date(),
                    isCurrent: true
                }
            });
        }

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Updated results sent date to ${new Date(resultsSentDate).toISOString().split('T')[0]} for student: ${student.firstName} ${student.lastName}`,
                entityId: studentId,
                entityType: "Student"
            }
        });

        res.status(200).json({
            message: 'Results sent date updated successfully',
            student: updatedStudent
        });

    } catch (error) {
        console.error('Error in updateResultsSentDate:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for updating senate approval date
export const updateSenateApprovalDate = async (req, res, next) => {
    try {
        const { studentId } = req.params;
        const { senateApprovalDate } = req.body;

        if (!studentId || !senateApprovalDate) {
            const error = new Error('Student ID and senate approval date are required');
            error.statusCode = 400;
            throw error;
        }

        // Check if student exists
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                statuses: {
                    where: { isCurrent: true },
                    include: { definition: true }
                }
            }
        });

        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        // Update the student with the senate approval date
        const updatedStudent = await prisma.student.update({
            where: { id: studentId },
            data: {
                senateApprovalDate: new Date(senateApprovalDate)
            }
        });

        // Find the "results approved by senate" status definition
        const senateApprovedStatus = await prisma.statusDefinition.findFirst({
            where: {
                name: "results approved by senate"
            }
        });

        const currentStatus = student.statuses[0];

        // Update student status if the status definition exists and it's not already the current status
        if (senateApprovedStatus && (!currentStatus || currentStatus.definition.name !== "results approved by senate")) {
            // First, update all current statuses to not current
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: studentId,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });
            
            // Create new student status
            await prisma.studentStatus.create({
                data: {
                    student: { connect: { id: studentId } },
                    definition: { connect: { id: senateApprovedStatus.id } },
                    startDate: new Date(),
                    isCurrent: true
                }
            });
        }

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Updated senate approval date to ${new Date(senateApprovalDate).toISOString().split('T')[0]} for student: ${student.firstName} ${student.lastName}`,
                entityId: studentId,
                entityType: "Student"
            }
        });

        res.status(200).json({
            message: 'Senate approval date updated successfully',
            student: updatedStudent
        });

    } catch (error) {
        console.error('Error in updateSenateApprovalDate:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

/*** DASHBOARD CONTROLLERS */

/**
 * Get dashboard statistics
 * @route GET /api/v1/management/dashboard/stats
 * @access Private (Admin, Management)
 */
export const getDashboardStats = async (req, res, next) => {
    try {
        // Get total students count
        const totalStudents = await prisma.student.count();
        
        // Get recently enrolled students (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentlyEnrolled = await prisma.student.count({
            where: {
                createdAt: {
                    gte: thirtyDaysAgo
                }
            }
        });
        
        // Get students by status
        const statusCounts = await prisma.studentStatus.groupBy({
            by: ['definitionId'],
            where: {
                isCurrent: true
            },
            _count: {
                studentId: true
            }
        });
        
        // Get status definitions to map counts
        const statusDefinitions = await prisma.statusDefinition.findMany();
        
        // Map status counts to their names
        const statusMap = {};
        statusCounts.forEach(status => {
            const definition = statusDefinitions.find(def => def.id === status.definitionId);
            if (definition) {
                statusMap[definition.name.toLowerCase().replace(/\s+/g, '')] = status._count.studentId;
            }
        });
        
        // Extract specific status counts
        const workshop = statusMap.workshop || 0;
        const normalProgress = statusMap.normalprogress || 0;
        const underExamination = statusMap.underexamination || 0;
        
        // Get total ongoing students (excluding graduated and deregistered)
        const ongoingStudents = await prisma.student.count({
            where: {
                statuses: {
                    some: {
                        isCurrent: true,
                        definition: {
                            name: {
                                notIn: ['graduated', 'deregistered']
                            }
                        }
                    }
                }
            }
        });
        
        // Log activity
        // await prisma.userActivity.create({
        //     data: {
        //         userId: req.user.id,
        //         action: 'Retrieved dashboard statistics',
        //         entityType: "System"
        //     }
        // });
        
        res.status(200).json({
            totalStudents: totalStudents.toLocaleString(),
            recentlyEnrolled: recentlyEnrolled.toString(),
            workshop: workshop.toString(),
            normalProgress: normalProgress.toString(),
            underExamination: underExamination.toString(),
            ongoingStudents: ongoingStudents.toString()
        });
        
    } catch (error) {
        console.error('Error in getDashboardStats:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for getting student status statistics for dashboard charts
export const getStatusStatistics = async (req, res, next) => {
  try {
    const { category = 'main' } = req.query;
    console.log("category", category);
    let whereCondition = {};
    let stats = [];
    
    // Define different category filters
    if (category === 'main') {
      whereCondition = {
        isCurrent: true,
        definition: {
          name: {
            in: [
              'normal progress',
              'fieldwork',
              'under examination',
              'scheduled for viva',
              'results approved',
              'results sent to schools',
              'results approved by senate',
             
            ]
          }
        }
      };
      
      stats = await prisma.studentStatus.groupBy({
        by: ['definitionId'],
        _count: true,
        where: whereCondition
      });
    } else if (category === 'proposal') {
      whereCondition = {
        isCurrent: true,
        definition: {
          name: {
            in: [
              'proposal received',
              'proposal in review',
              'waiting for proposal defense',
              'compliance report submitted',
              'letter to field issued'
            ]
          }
        }
      };
      
      stats = await prisma.proposalStatus.groupBy({
        by: ['definitionId'],
        _count: true,
        where: whereCondition
      });
    } else if (category === 'book') {
      whereCondition = {

        definition: {
          name: {
            in: [
              'book planning',
              'book writing',
              'book submitted',
              'book under review',
              'book published'
            ]
          }
        }
      };
      
      stats = await prisma.bookStatus.groupBy({
        by: ['definitionId'],
        _count: true,
        where: whereCondition
      });
    }

    // Then get the definitions to map names
    const definitions = await prisma.statusDefinition.findMany({
      where: {
        id: {
          in: stats.map(stat => stat.definitionId)
        }
      },
      select: {
        id: true,
        name: true,
        color: true
      }
    });
  
    // Create a map of definition IDs to names and colors
    const definitionMap = definitions.reduce((acc, def) => {
      acc[def.id] = {
        name: def.name,
        color: def.color || getDefaultColor(def.name)
      };
      return acc;
    }, {});
  
    // Transform the data into an array with status, students, and fill
    const statusArray = stats.map(stat => {
      const definition = definitionMap[stat.definitionId];
      return {
        status: definition.name,
        students: stat._count,
        fill: definition.color
      };
    });
    
    res.json(statusArray);
  } catch (error) {
    console.error('Error in getStatusStatistics:', error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Helper function to get default colors if not provided in the database
const getDefaultColor = (statusName) => {
  const colorMap = {
    'normal progress': '#22C55E',
    'fieldwork': '#3B82F6',
    'under examination': '#EAB308',
    'scheduled for viva': '#EC4899',
    'results approved': '#14B8A6'
  };
  
  return colorMap[statusName.toLowerCase()] || '#6B7280'; // Default gray color
};

export const getProgressTrends = async (req, res, next) => {
    try {
      const { timeRange } = req.query;
      const daysToLookBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
  
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysToLookBack);
  
      // Get all relevant status changes in the time period
      const statusChanges = await prisma.studentStatus.findMany({
        where: {
          createdAt: {
            gte: startDate
          },
          definition: {
            name: {
              in: ['book submitted', 'under examination', 'scheduled for viva']
            }
          }
        },
        include: {
          definition: {
            select: {
              name: true,
              color: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
  
      // Generate array of dates
      const dates = [];
      for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }
  
      // Define default colors for each status
      const defaultColors = {
        'book submitted': '#23388F',  // dark blue
        'under examination': '#EAB308',  // yellow
        'scheduled for viva': '#EC4899'  // pink
      };
  
      // Get the colors from status definitions
      const statusDefinitions = await prisma.statusDefinition.findMany({
        where: {
          name: {
            in: ['book submitted', 'under examination', 'scheduled for viva']
          }
        },
        select: {
          name: true,
          color: true
        }
      });
      
      // Create a map of status names to their colors
      const statusColors = {};
      statusDefinitions.forEach(def => {
        statusColors[def.name] = def.color || defaultColors[def.name];
      });
     
      
      // Use these colors consistently across all data points
      const submissionsColor = statusColors['book submitted'] || defaultColors['book submitted'];
      const examinationsColor = statusColors['under examination'] || defaultColors['under examination'];
      const vivasColor = statusColors['scheduled for viva'] || defaultColors['scheduled for viva'];
      // Transform the data into daily counts
      const stats = dates.map(date => {
        const dayStart = new Date(date.setHours(0, 0, 0, 0));
        const dayEnd = new Date(date.setHours(23, 59, 59, 999));
        
        const dayStats = statusChanges.filter(status => 
          status.createdAt >= dayStart && status.createdAt <= dayEnd
        );
  
        const submissionStats = dayStats.filter(s => s.definition.name === 'book submitted');
        const examinationStats = dayStats.filter(s => s.definition.name === 'under examination');
        const vivaStats = dayStats.filter(s => s.definition.name === 'scheduled for viva');
  
        return {
          date: dayStart.toISOString().split('T')[0],
          submissions: submissionStats.length,
          submissionsColor: submissionsColor,
          examinations: examinationStats.length,
          examinationsColor: examinationsColor,
          vivas: vivaStats.length,
          vivasColor: vivasColor
        };
      });
  
      res.json(stats);
  
    } catch (error) {
      console.error('Error fetching progress trends:', error);
      next(error);
    }
  };


/*** NOTIFICATION CONTROLLERS */

// Controller to get notifications
export const getNotifications = async (req, res, next) => {
  try {
    // Get all notifications with student status information
    const notifications = await prisma.notification.findMany({
      include: {
        studentStatus: {
          include: {
            definition: true,
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              
              }
            }
          }
        }
      },
      orderBy: {
        scheduledFor: 'desc'
      }
    });
    
    console.log("notifications", notifications);
    
    res.status(200).json({
      notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller to get status report for all students
export const getAllStudentsStatusReport = async (req, res, next) => {
  try {
    // Find all students with their current status
    const students = await prisma.student.findMany({
      include: {
        studentStatuses: {
          include: {
            definition: true,
            notifications: true
          },
          orderBy: {
            startDate: 'desc'
          }
        }
      }
    });

    const today = new Date();
    const statusReports = [];

    for (const student of students) {
      // Get current status
      const currentStatus = student.studentStatuses.find(status => status.isCurrent);
      
      if (!currentStatus) {
        continue; // Skip students without a current status
      }

      // Calculate expected end date based on definition duration
      const startDate = new Date(currentStatus.startDate);
      const expectedDuration = currentStatus.definition.expectedDurationDays;
      const expectedEndDate = new Date(startDate);
      expectedEndDate.setDate(expectedEndDate.getDate() + expectedDuration);
      
      // Calculate if status is delayed
      const isDelayed = today > expectedEndDate;
      
      // Calculate days in status
      const daysInStatus = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
      
      // Calculate days remaining or days overdue
      let daysRemaining = 0;
      let daysOverdue = 0;
      
      if (isDelayed) {
        daysOverdue = Math.floor((today - expectedEndDate) / (1000 * 60 * 60 * 24));
      } else {
        daysRemaining = Math.floor((expectedEndDate - today) / (1000 * 60 * 60 * 24));
      }

      // Get notifications related to this status
      const statusNotifications = currentStatus.notifications || [];

      // Prepare the status report for this student
      statusReports.push({
        student: {
          id: student.id,
          name: `${student.firstName} ${student.lastName}`,
          email: student.email
        },
        currentStatus: {
          id: currentStatus.id,
          name: currentStatus.definition.name,
          description: currentStatus.definition.description,
          startDate: currentStatus.startDate,
          expectedDurationDays: expectedDuration,
          expectedEndDate: expectedEndDate,
          daysInStatus,
          isDelayed,
          daysRemaining: isDelayed ? 0 : daysRemaining,
          daysOverdue: isDelayed ? daysOverdue : 0
        },
        notifications: statusNotifications.map(notification => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          scheduledFor: notification.scheduledFor,
          sentAt: notification.sentAt,
          statusType: notification.statusType
        }))
      });
    }

    res.status(200).json({
      statusReports
    });
  } catch (error) {
    console.error('Error generating all students status report:', error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller to get status report for a single student
export const getStudentStatusReport = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    // Find the student with their current status
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        studentStatuses: {
          include: {
            definition: true,
            notifications: true
          },
          orderBy: {
            startDate: 'desc'
          }
        }
      }
    });

    if (!student) {
      const error = new Error('Student not found');
      error.statusCode = 404;
      throw error;
    }

    // Get current status (should be the first one as we ordered by startDate desc)
    const currentStatus = student.studentStatuses.find(status => status.isCurrent);
    
    if (!currentStatus) {
      const error = new Error('No current status found for student');
      error.statusCode = 404;
      throw error;
    }

    // Calculate expected end date based on definition duration
    const startDate = new Date(currentStatus.startDate);
    const expectedDuration = currentStatus.definition.expectedDurationDays;
    const expectedEndDate = new Date(startDate);
    expectedEndDate.setDate(expectedEndDate.getDate() + expectedDuration);
    
    // Calculate if status is delayed
    const today = new Date();
    const isDelayed = today > expectedEndDate;
    
    // Calculate days in status
    const daysInStatus = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    
    // Calculate days remaining or days overdue
    let daysRemaining = 0;
    let daysOverdue = 0;
    
    if (isDelayed) {
      daysOverdue = Math.floor((today - expectedEndDate) / (1000 * 60 * 60 * 24));
    } else {
      daysRemaining = Math.floor((expectedEndDate - today) / (1000 * 60 * 60 * 24));
    }

    // Get notifications related to this status
    const statusNotifications = await prisma.notification.findMany({
      where: {
        studentStatusId: currentStatus.id
      },
      orderBy: {
        scheduledFor: 'desc'
      }
    });

    // Prepare the status report
    const statusReport = {
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email
      },
      currentStatus: {
        id: currentStatus.id,
        name: currentStatus.definition.name,
        description: currentStatus.definition.description,
        startDate: currentStatus.startDate,
        expectedDurationDays: expectedDuration,
        expectedEndDate: expectedEndDate,
        daysInStatus,
        isDelayed,
        daysRemaining: isDelayed ? 0 : daysRemaining,
        daysOverdue: isDelayed ? daysOverdue : 0
      },
      notifications: statusNotifications.map(notification => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        scheduledFor: notification.scheduledFor,
        sentAt: notification.sentAt,
        statusType: notification.statusType
      })),
      statusHistory: student.studentStatuses
        .filter(status => !status.isCurrent)
        .map(status => ({
          id: status.id,
          name: status.definition.name,
          startDate: status.startDate,
          endDate: status.endDate,
          expectedDurationDays: status.definition.expectedDurationDays,
          actualDurationDays: status.endDate 
            ? Math.floor((new Date(status.endDate) - new Date(status.startDate)) / (1000 * 60 * 60 * 24))
            : null
        }))
    };

    res.status(200).json({
      statusReport
    });
  } catch (error) {
    console.error('Error generating student status report:', error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for requesting a password reset
export const requestPasswordReset = async (req, res, next) => {
    try {
        const { email } = req.body;

        
        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { email }
        });
        
        if (!user) {
            const error = new Error('No account found with that email address');
            error.statusCode = 404;
            throw error;
        }
        
        // Generate a reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000); // Token valid for 1 hour
        
        // Save the reset token to the faculty record
        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken,
                resetTokenExpiry
            }
        });
        
        // Create nodemailer transporter
        const transporter = nodemailer.createTransport({
            // host: process.env.EMAIL_HOST,
            host: 'smtp.gmail.com',
            // port: process.env.EMAIL_PORT,
            port: 587,
            // secure: process.env.EMAIL_SECURE === 'true',
            secure: true,
            auth: {
                user: process.env.NODE_MAILER_USERCRED,
                pass: process.env.NODE_MAILER_PASSCRED
            }
        });
        
        // Frontend URL for password reset
        const frontendUrl = process.env.FACULTY_CLIENT_URL || 'https://umimanagement.netlify.app';
        // const frontendUrl = process.env.FACULTY_CLIENT_URL || 'http://localhost:5173';
        const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
        
        // Email template
        const emailTemplate = `
            <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #4a6da7; color: white; padding: 10px; text-align: center; }
                        .content { padding: 20px; border: 1px solid #ddd; }
                        .button { display: inline-block; background-color: #4a6da7; color: white; padding: 10px 20px; 
                                text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { font-size: 12px; text-align: center; margin-top: 20px; color: #777; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>Password Reset Request</h2>
                        </div>
                        <div class="content">
                            <p>Hello ${user.name},</p>
                            <p>We received a request to reset your password for your UMI Faculty account.</p>
                            <p>Please click the button below to reset your password. This link will expire in 1 hour.</p>
                            <p><a href="${resetLink}" class="button">Reset Password</a></p>
                            <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
                            <p>If the button above doesn't work, copy and paste this link into your browser:</p>
                            <p>${resetLink}</p>
                        </div>
                        <div class="footer">
                            <p>This is an automated message, please do not reply to this email.</p>
                            <p>&copy; ${new Date().getFullYear()} UMI Research Management System</p>
                        </div>
                    </div>
                </body>
            </html>
        `;
        
        // Send email
        await transporter.sendMail({
            from: `"UMI Research Management" <${process.env.NODE_MAILER_USERCRED}>`,
            to: user.email,
            subject: 'Password Reset Request',
            html: emailTemplate
        });
        
        res.status(200).json({
            message: 'Password reset link has been sent to your email'
        });
    } catch (error) {
        console.error('Password reset request error:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for resetting password with token
export const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;
        
        // Find faculty with valid reset token
        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: {
                    gt: new Date()
                }
            }
        });
        
        if (!user) {
            const error = new Error('Invalid or expired reset token');
            error.statusCode = 400;
            throw error;
        }
        
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        
        // Update password and clear reset token
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null
            }
        });
        
        // Create nodemailer transporter
        const transporter = nodemailer.createTransport({
            // host: process.env.EMAIL_HOST,
            host: 'smtp.gmail.com',
            // port: process.env.EMAIL_PORT,
            port: 587,
            // secure: process.env.EMAIL_SECURE === 'true',
            secure: false,
            auth: {
                user: process.env.NODE_MAILER_USERCRED,
                pass: process.env.NODE_MAILER_PASSCRED
            }
        });
        
        // Email template for successful password reset
        const confirmationTemplate = `
            <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #4a6da7; color: white; padding: 10px; text-align: center; }
                        .content { padding: 20px; border: 1px solid #ddd; }
                        .footer { font-size: 12px; text-align: center; margin-top: 20px; color: #777; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>Password Reset Successful</h2>
                        </div>
                        <div class="content">
                            <p>Hello ${user.name},</p>
                            <p>Your password has been successfully reset.</p>
                            <p>If you did not make this change, please contact our support team immediately.</p>
                        </div>
                        <div class="footer">
                            <p>This is an automated message, please do not reply to this email.</p>
                            <p>&copy; ${new Date().getFullYear()} UMI Research Management System</p>
                        </div>
                    </div>
                </body>
            </html>
        `;
        
        // Send confirmation email
        await transporter.sendMail({
            from: `"UMI Research Management" <${process.env.NODE_MAILER_USERCRED}>`,
            to: user.email,
            subject: 'Password Reset Successful',
            html: confirmationTemplate
        });
        
        res.status(200).json({
            message: 'Password has been reset successfully'
        });
    } catch (error) {
        console.error('Password reset error:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};






/** GRADUATION MANAGEMENT */
/**
 * Get all students with senate-approved results who are eligible for graduation
 * @route GET /api/v1/management/students/senate-approved
 * @access Private - Admin only
 */
// export const getSenateApprovedStudents = async (req, res, next) => {
//     try {
//         // Get all students with their current status being "results approved by senate"
//         const students = await prisma.student.findMany({
//             include: {
//               studentStatuses: {
//                 include: {
//                   definition: true,
//                   notifications: true
//                 },
//                 orderBy: {
//                   startDate: 'desc'
//                 }
//               }
//             }
//           });
//         // const students = await prisma.student.findMany({
//         //     where: {
//         //         statuses: {
//         //             some: {
//         //                 isCurrent: true,
//         //                 definition: {
//         //                     name: 'results approved by senate'
//         //                 }
//         //             }
//         //         }
//         //     },
//         //     include: {
//         //         statuses: {
//         //             where: {
//         //                 isCurrent: true
//         //             },
//         //             include: {
//         //                 definition: true
//         //             }
//         //         },
//         //         supervisor: {
//         //             select: {
//         //                 name: true
//         //             }
//         //         },
//         //         program: {
//         //             select: {
//         //                 name: true
//         //             }
//         //         },
//         //         thesis: {
//         //             select: {
//         //                 title: true
//         //             }
//         //         }
//         //     },
//         //     orderBy: {
//         //         lastName: 'asc'
//         //     }
//         // });

//         // Format the response data
//         const formattedStudents = students.map(student => ({
//             id: student?.id,
//             studentNumber: student?.studentNumber,
//             name: `${student?.firstName} ${student?.lastName}`,
//             program: student?.program?.name || 'N/A',
//             supervisor: student?.supervisor?.name || 'N/A',
//             thesisTitle: student?.thesis?.title || 'N/A',
//             currentStatus: student?.statuses[0]?.definition?.name || 'N/A',
//             isInGraduationList: student?.statuses[0]?.definition?.name === 'graduated'
//         }));

//         res.status(200).json({
//             success: true,
//             count: formattedStudents.length,
//             students: formattedStudents // Changed from data to students to match frontend expectations
//         });
//     } catch (error) {
//         console.error('Error fetching senate approved students:', error);
//         if (!error.statusCode) {
//             error.statusCode = 500;
//         }
//         next(error);
//     }
// };

/**
 * Add a student to the graduation list
 * @route POST /api/v1/management/graduation
 * @access Private - Admin only
 */
// export const addStudentToGraduation = async (req, res, next) => {
//     try {
//         const { studentId, academicYear } = req.body;

//         if (!studentId || !academicYear) {
//             const error = new Error('Student ID and academic year are required');
//             error.statusCode = 400;
//             throw error;
//         }

//         // Update the student status to GRADUATED and set the academic year
//         const updatedStudent = await prisma.student.update({
//             where: {
//                 id: studentId
//             },
//             data: {
//                 status: 'GRADUATED',
//                 academicYear: academicYear
//             }
//         });

//         res.status(200).json({
//             success: true,
//             message: 'Student added to graduation list successfully',
//             data: updatedStudent
//         });
//     } catch (error) {
//         if (!error.statusCode) {
//             error.statusCode = 500;
//         }
//         next(error);
//     }
// };




export const getGraduationStatistics = async (req, res) => {
    try {
      const currentYear = new Date().getFullYear();
      const currentAcademicYear = `${currentYear}/${currentYear + 1}`;
  
      // Get total graduates
      const totalGraduates = await prisma.student.count({
        where: {
          statuses: {
            some: {
              definition: {
                name: 'graduated'
              }
            }
          }
        }
      });
  
      // Get current year graduates
      const currentYearGraduates = await prisma.student.count({
        where: {
            statuses: {
                some: {
                definition: {
                    name: 'graduated'
                }
                }
            },
          gradAcademicYear: currentAcademicYear
        }
      });
  
      // Get pending graduation (senate approved)
      const pendingGraduation = await prisma.student.count({
        where: {
          statuses: {
            some: {
              definition: {
                name: 'results approved by senate'
              }
            }
          }
        }
      });
  
      // Get yearly trends
      const yearlyTrends = await prisma.student.groupBy({
        by: ['gradAcademicYear', 'programLevel'],
        where: {
          statuses: {
            some: {
              definition: {
                name: 'graduated'
              }
            }
          },
          gradAcademicYear: {
            not: null
          }
        },
        _count: {
          id: true
        },
        orderBy: {
          gradAcademicYear: 'asc'
        },
        take: 6 // Last 6 academic years
      });
  
      // Transform data for graph
      const trends = yearlyTrends.reduce((acc, curr) => {
        const year = curr.gradAcademicYear;
        if (!acc[year]) {
          acc[year] = { 
            academicYear: year, 
            graduates: 0, 
            phd: 0, 
            masters: 0 
          };
        }
        acc[year].graduates += curr._count.id;
        if (curr.programLevel.includes('PHD')) {
          acc[year].phd += curr._count.id;
        } else {
          acc[year].masters += curr._count.id;
        }
        return acc;
      }, {});
  
      res.json({
        totalGraduates,
        currentYearGraduates,
        pendingGraduation,
        yearlyTrends: Object.values(trends)
      });
    } catch (error) {
      console.error('Error fetching graduation statistics:', error);
      res.status(500).json({ message: 'Error fetching graduation statistics' });
    }
  };
  
  export const addStudentToGraduation = async (req, res) => {
    const { studentId, academicYear } = req.body; // academicYear format: "2023/2024"
  
    try {
      // Start a transaction
      const result = await prisma.$transaction(async (prisma) => {
        // Find the graduated status definition
        const graduatedStatusDef = await prisma.statusDefinition.findFirst({
          where: { name: 'graduated' }
        });
        
        if (!graduatedStatusDef) {
          throw new Error('Graduated status definition not found');
        }
        
        // Update all current statuses to not current
        await prisma.studentStatus.updateMany({
          where: { 
            studentId,
            isCurrent: true 
          },
          data: { isCurrent: false, endDate: new Date() }
        });
        
        // Create new student status
        await prisma.studentStatus.create({
          data: {
            student: {connect: {id: studentId}},
            definition: { connect: { id: graduatedStatusDef.id } },
            startDate: new Date(),
            isCurrent: true,
            updatedBy: {connect: {id: req.user.id}} // Assuming req.user contains the logged-in user
          }
        });
        
        // Update student
        const updatedStudent = await prisma.student.update({
          where: { id: studentId },
          data: {
            currentStatus: 'graduated',
            gradAcademicYear: academicYear,
            graduatedAt: new Date()
          }
        });
  
        // Create graduation record
        await prisma.graduation.create({
          data: {
            studentId,
            academicYear: academicYear,
            programLevel: updatedStudent.programLevel,
            graduationDate: new Date(),
          }
        });
  
        return updatedStudent;
      });
  
      res.json(result);
    } catch (error) {
      console.error('Error adding student to graduation:', error);
      res.status(500).json({ message: 'Error adding student to graduation' });
    }
  };










