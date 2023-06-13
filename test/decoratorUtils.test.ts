import { MemberMetaDecorator, getMembers } from '@/decoratorUtils'

describe('memberMetaDecorator', () => {
    test('getMembers', () => {
        const testDecorator = MemberMetaDecorator((target, key) => {
            return key ? target[key] : target
        })

        @testDecorator
        class A {
            @testDecorator
            private a: number

            @testDecorator
            public b: string

            @testDecorator
            c() {
                console.debug('hello')
            }
        }

        const e = expect(getMembers(A))
        e.toContain('a')
        e.toContain('b')
        e.toContain('c')
    })
})
