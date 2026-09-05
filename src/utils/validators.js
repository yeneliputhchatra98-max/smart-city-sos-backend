const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};


const validatePassword = (password) => {
    // At least 8 characters,
    // 1 uppercase,
    // 1 lowercase,
    // 1 number

    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

    return re.test(password);
};


const validatePhone = (phone) => {
    if (!phone) return false;

    const cleanedPhone = phone
        .toString()
        .trim()
        .replace(/[\s-]/g, "");

    const re = /^(0[1-9]\d{7,9}|\+855[1-9]\d{7,9}|855[1-9]\d{7,9})$/;

    return re.test(cleanedPhone);
};


module.exports = {
    validateEmail,
    validatePassword,
    validatePhone
};