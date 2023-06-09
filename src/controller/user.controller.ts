// export const userService = new (class implements IOService {
//     init(socket: Socket): void {
//         socket.on('hello', (to: string) => {
//             return `hello ${to}`
//         })
//     }
// })()
export default {
    path: 'url',
    routes: [
        {
            hello(to: string) {
                return `hello ${to}`
            },
            async helloAsync(to: string) {
                return `hello ${to}`
            },
        },
    ],
}
