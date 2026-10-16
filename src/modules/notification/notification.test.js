import { sendNotification } from "./notification.service.js";


async function testNotification() {

  const userId = "e049f6eb-c3b8-453e-9333-c7aa8df98acd";

  const notification =
    await sendNotification({
      userId,
      title: "Welcome to Evault",
      message:
        "Your notification system is working successfully.",
      type: "INFO",
      metadata: {
        source: "TEST",
      },
    });


  console.log(
    "Created Notification:",
    notification
  );
}


testNotification()
  .catch((error) => {
    console.error(
      "Notification Test Failed:",
      error.message
    );
  });