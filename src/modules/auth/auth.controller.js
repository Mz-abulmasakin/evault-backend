import { registerUser, loginUser } from "./auth.service.js";

export const register = async (req, res, next) => {
  try {
    const user = await registerUser(req.body);

    res.status(201).json({
      status: "success",
      message: "Account created successfully",
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    const result = await loginUser({ identifier, password });

    res.status(200).json({
      status: "success",
      message: "Login successful",
      data: result,
    });
  } catch (error) {
   res.status(401).json({
      status: "error",
      message: error.message || "Invalid Phone NUmber/Email or password",
    });
  }
};