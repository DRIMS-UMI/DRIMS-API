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

// Controller for creating a supervisor
export const createSupervisor = async (req, res, next) => {
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
                vivas: true,
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
                vivas: true,
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




// Controller for accessing the management portal
export const accessManagementPortal = (req, res) => {
    res.send('Welcome to the Management Portal');
}; 