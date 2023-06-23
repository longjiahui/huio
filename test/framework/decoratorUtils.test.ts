import {
    createMemberMetaDecorator,
    getMembers,
} from '@/framework/lib/decoratorUtils'

describe('createMemberMetaDecorator', () => {
    test('getMembers', () => {
        const innerDecoratorA = (target, key) => {
            return key ? target[key] : target
        }

        const decoratorA = createMemberMetaDecorator(
            innerDecoratorA,
            innerDecoratorA,
        )
        const decoratorB = createMemberMetaDecorator((target, key) => {
            return key ? target[key] : target
        })

        class A {
            @decoratorA
            private a!: number

            @decoratorA
            public b!: string

            @decoratorB
            c() {
                console.debug('hello')
            }
        }
        // const ma = expect(getMembers(A, decoratorA))
        const minnera = expect(getMembers(A, innerDecoratorA))
        const minnerb = expect(getMembers(A, decoratorB))
        // ma.toContain('a')
        // ma.toContain('b')
        minnera.toContain('a')
        minnera.toContain('b')
        minnerb.toContain('c')
    })
})
