import { Provide } from '@/framework/dic'
import { Schema, model } from 'mongoose'

export interface IUser {
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

export const UserModel = model<IUser>('User', userSchema)
Provide(() => UserModel)(UserModel)
