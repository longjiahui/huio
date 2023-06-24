import { Controller } from '@/framework/controller'
import { Provide } from '@/framework/dic'
import { Route, routeControllers } from '@/framework/router'

describe('Router', () => {
    test('Router Default', async () => {
        @Route.path('user')
        @Provide(() => new UserController())
        class UserController extends Controller {
            @Route.default()
            hello() {
                return 'hello world'
            }

            @Route.path('get')
            async get() {
                return 1
            }
        }

        const { routes } = await routeControllers([UserController])
        const routePaths = Object.keys(routes)
        expect(routePaths).toContain('user')
        expect(routePaths).toContain('user.get')
    })
})
