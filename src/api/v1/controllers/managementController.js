import bcrypt from 'bcryptjs';
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
        const { name, email, phone, designation, schoolId, isAdmin, role } = req.body;

        // Check if faculty member already exists
        const existingFaculty = await prisma.facultyMember.findUnique({
            where: { email }
        });

        if (existingFaculty) {
            const error = new Error('Faculty member with this email already exists');
            error.statusCode = 400;
            throw error;
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            const error = new Error('User with this email already exists');
            error.statusCode = 400;
            throw error;
        }

        // Create user first
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: Math.random().toString(36).slice(-8), // Generate random password
                phone,
                designation,
                role
            }
        });

        // Create faculty member and link user
        const facultyMember = await prisma.facultyMember.create({
            data: {
                name,
                email,
                phone,
                designation,
                schoolId,
                role,
                isAdmin: isAdmin || false,
                userId: user.id
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
        const facultyMembers = await prisma.facultyMember.findMany({
            include: {
                school: true,
                user: true
            }
        });

        res.status(200).json({
            facultyMembers
        });
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
        const { id } = req.params;

        const facultyMember = await prisma.facultyMember.findUnique({
            where: { id },
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
        const { id } = req.params;
        const { name, email, phone, designation, schoolId, isAdmin } = req.body;

        const updatedFacultyMember = await prisma.facultyMember.update({
            where: { id },
            data: {
                name,
                email,
                phone,
                designation,
                schoolId,
                isAdmin
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

// Controller for deleting a faculty member
export const deleteFacultyMember = async (req, res, next) => {
    try {
        const { id } = req.params;

        await prisma.facultyMember.delete({
            where: { id }
        });

        res.status(200).json({
            message: 'Faculty member deleted successfully'
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