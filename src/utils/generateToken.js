import jwt from 'jsonwebtoken';

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      storeId: user.storeId,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

export default generateToken;