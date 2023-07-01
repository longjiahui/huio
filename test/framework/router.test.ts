import { Controller } from '@/framework/controller'
import { createDIC } from '@/framework/lib/di'
import { Route, router } from '@/framework/router'

describe('Router', () => {
    test('Router Default', async () => {
        const { dic, Provide } = createDIC()
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

        const { routes } = await router.routeControllers([UserController], dic)
        const routePaths = Object.keys(routes)
        expect(routePaths).toContain('user')
        expect(routePaths).toContain('user.get')
    })
})
