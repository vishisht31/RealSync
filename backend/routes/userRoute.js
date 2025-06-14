
import express from "express";
import { login, register } from "../controllers/user.js";


const userRouter=express.Router()

userRouter.post('/login', login);
userRouter.post('/register', register);


export default userRouter
