import { DI, injectableKey } from '@/di'
import 'reflect-metadata'

describe('DI Decorator', () => {
    test('default', () => {
        @DI()
        class A {}
        expect(Reflect.getMetadata(injectableKey, A)).toBe(true)
    })
})

describe('DICenter', () => {
    test('get')
})
