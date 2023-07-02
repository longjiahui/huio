import { App } from './framework/app'
import { Inject } from './framework/lib/di'
import { Route } from './framework/router'
import { Provide } from './framework/dic'
import { IUser, UserModel } from './model/user'
import mongoose, { Model } from 'mongoose'

@Provide(() => new UserService())
class UserService {
    @Inject.key(UserModel)
    private userModel!: Model<IUser>

    get() {
        return this.userModel.find()
    }
    getUserById(id: string) {
        return this.userModel.findById(id)
    }
    create(user: IUser) {
        return this.userModel.create(user)
    }
}

@Route.path('user')
@Provide()
class UserController {
    @Inject.key(UserService)
    private userService!: UserService

    @Route.path('getById')
    async getById(id: string /*, @Inject.key(Socket) socket: Socket*/) {
        return [await this.userService.getUserById(id)]
    }

    @Route.path('get')
    async get() {
        return [(await this.userService.get()).map((d) => d.toObject())]
    }

    @Route.path('create')
    async create(user: IUser) {
        await this.userService.create(user)
    }
}

const app = new App({
    port: 3000,
    mongoConfig: {
        url: 'mongodb://localhost:27017/group',
    },
    socketControllers: [UserController],
    httpControllers: [UserController],
})
app.appLayer.install(async (next, setting) => {
    await mongoose.connect(setting.mongoConfig.url)
    return next(setting)
})
app.eventLayer.install(async (next, ...rest) => {
    try {
        await next(...rest)
    } catch (err) {
        // logger
        console.error(err)
    }
})
app.start()
