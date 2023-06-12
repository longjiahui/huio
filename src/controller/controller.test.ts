import { Route, mapRoutes } from './controller'

class User {
    constructor(public name: string) {}
}

@Route('/user')
export class UserController {
    @Route('/get')
    get(): User {
        return new User('hello')
    }
}

console.debug(mapRoutes([UserController]))
