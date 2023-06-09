import { Schema } from 'mongoose'

interface IUser {
    name?: string
    email?: string
    avatar?: string
    password?: string
}

const userSchema = new Schema<IUser>({
    name: { type: String },
    email: { type: String },
    password: { type: String },
    avatar: { type: String },
})
