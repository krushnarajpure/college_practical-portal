const departments = [
    { _id: 'dept-cse', id: 'dept-cse', name: 'Computer Science', code: 'CSE', description: 'Computer science and software engineering.', status: 'active' },
    { _id: 'dept-ece', id: 'dept-ece', name: 'Electronics', code: 'ECE', description: 'Electronics and communication engineering.', status: 'active' },
    { _id: 'dept-mech', id: 'dept-mech', name: 'Mechanical', code: 'MEC', description: 'Mechanical engineering studies.', status: 'active' }
];

const years = [
    { _id: 'year-1', id: 'year-1', name: 'First Year', code: 'YEAR-1', academicLevel: 1, order: 1, status: 'active' },
    { _id: 'year-2', id: 'year-2', name: 'Second Year', code: 'YEAR-2', academicLevel: 2, order: 2, status: 'active' },
    { _id: 'year-3', id: 'year-3', name: 'Third Year', code: 'YEAR-3', academicLevel: 3, order: 3, status: 'active' },
    { _id: 'year-4', id: 'year-4', name: 'Fourth Year', code: 'YEAR-4', academicLevel: 4, order: 4, status: 'active' }
];

const semesters = [
    { _id: 'sem-1', id: 'sem-1', name: 'Semester 1', code: 'SEM1', number: 1, yearId: 'year-1', status: 'active' },
    { _id: 'sem-2', id: 'sem-2', name: 'Semester 2', code: 'SEM2', number: 2, yearId: 'year-1', status: 'active' },
    { _id: 'sem-3', id: 'sem-3', name: 'Semester 3', code: 'SEM3', number: 3, yearId: 'year-2', status: 'active' },
    { _id: 'sem-4', id: 'sem-4', name: 'Semester 4', code: 'SEM4', number: 4, yearId: 'year-2', status: 'active' },
    { _id: 'sem-5', id: 'sem-5', name: 'Semester 5', code: 'SEM5', number: 5, yearId: 'year-3', status: 'active' },
    { _id: 'sem-6', id: 'sem-6', name: 'Semester 6', code: 'SEM6', number: 6, yearId: 'year-3', status: 'active' },
    { _id: 'sem-7', id: 'sem-7', name: 'Semester 7', code: 'SEM7', number: 7, yearId: 'year-4', status: 'active' },
    { _id: 'sem-8', id: 'sem-8', name: 'Semester 8', code: 'SEM8', number: 8, yearId: 'year-4', status: 'active' }
];

const subjects = [
    {
        _id: 'sub-java', id: 'sub-java', name: 'Java Programming', subjectCode: 'JAVA101', description: 'Core Java programming and object-oriented fundamentals.',
        departmentId: 'dept-cse', yearId: 'year-2', semesterId: 'sem-3', status: 'active'
    },
    {
        _id: 'sub-dbms', id: 'sub-dbms', name: 'Database Management Systems', subjectCode: 'DBMS201', description: 'Relational databases, SQL, and schema design.',
        departmentId: 'dept-cse', yearId: 'year-2', semesterId: 'sem-4', status: 'active'
    },
    {
        _id: 'sub-digital', id: 'sub-digital', name: 'Digital Electronics', subjectCode: 'DIG204', description: 'Logic gates, circuits, and digital system design.',
        departmentId: 'dept-ece', yearId: 'year-2', semesterId: 'sem-4', status: 'active'
    },
    {
        _id: 'sub-thermo', id: 'sub-thermo', name: 'Thermodynamics', subjectCode: 'THER101', description: 'Energy systems, heat transfer, and thermal cycles.',
        departmentId: 'dept-mech', yearId: 'year-2', semesterId: 'sem-3', status: 'active'
    }
];

const users = [
    {
        id: 'student-demo', email: 'student@college.edu', name: 'Aarav Sharma', role: 'student',
        studentId: 'CS-2024-101', departmentId: 'dept-cse', yearId: 'year-2', semesterId: 'sem-3', password: 'student123'
    },
    {
        id: 'teacher-demo', email: 'teacher@college.edu', name: 'Dr. Meera Nair', role: 'teacher',
        employeeId: 'EMP-1101', departmentId: 'dept-cse', assignedSubjects: ['sub-java', 'sub-dbms'], password: 'teacher123'
    },
    {
        id: 'admin-demo', email: 'admin@college.edu', name: 'Admin User', role: 'admin', password: 'admin123'
    }
];

const notifications = [
    { id: 'notif-1', role: 'student', title: 'New practical published', time: '2h ago' },
    { id: 'notif-2', role: 'teacher', title: 'Review pending practical', time: 'Today' },
    { id: 'notif-3', role: 'admin', title: 'Academic sync complete', time: 'Yesterday' }
];

export { departments, years, semesters, subjects, users, notifications };
export default { departments, years, semesters, subjects, users, notifications };
