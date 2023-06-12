import { DI, injectableKey } from '@/di'
import 'reflect-metadata'

describe('di', () => {
    test('DI decorator', () => {
        @DI()
        class A {}
        expect(Reflect.getMetadata(injectableKey, A)).toBe(true)
    })
})
