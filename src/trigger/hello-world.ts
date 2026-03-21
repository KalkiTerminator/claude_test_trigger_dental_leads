import { task } from "@trigger.dev/sdk/v3";

export const helloWorld = task({
  id: "hello-world",
  run: async (payload: { message: string }) => {
    console.log(`Hello, ${payload.message}!`);
    return { success: true, message: payload.message };
  },
});
