import { DI, DICenter, Inject } from './di'

@DI()
class B {
    a = 12
    constructor(b: number) {
        this.a = b
    }
}

@DI()
class A {
    constructor(b: B) {
        console.debug(b)
    }

    @DI()
    b(a: A, @Inject(() => new B(33)) b: B) {
        return a.constructor.name + b.constructor.name + b.a
    }
}

const a = new DICenter().get(A)
console.debug(a)
console.debug(new DICenter().get(a, 'b')())
