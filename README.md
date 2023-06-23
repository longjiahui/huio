# 

## interface

```js
const { Provide, Inject } = new DIC()

@Provide({
    life: new Life()
})
class A{}

@Inject()
class B{}
```