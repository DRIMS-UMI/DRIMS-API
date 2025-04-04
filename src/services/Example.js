// Schedule a notification
await notificationService.scheduleNotification({
    type: 'EMAIL',
    title: 'Viva Reminder',
    message: 'Your viva is scheduled for tomorrow',
    recipientId: student.id,
    scheduledFor: vivaDate,
    metadata: {
      vivaId: viva.id,
      additionalContent: `
        <p>Location: ${viva.location}</p>
        <p>Time: ${viva.time}</p>
      `
    }
  });
  
  // Schedule a reminder series
  const scheduleVivaReminders = async (viva) => {
    // 1 week before
    await notificationService.scheduleNotification({
      type: 'EMAIL',
      title: 'Upcoming Viva - 1 Week Notice',
      message: 'Your viva is scheduled for next week',
      recipientId: viva.studentId,
      scheduledFor: subDays(viva.date, 7)
    });
  
    // 1 day before
    await notificationService.scheduleNotification({
      type: 'EMAIL',
      title: 'Viva Tomorrow',
      message: 'Your viva is scheduled for tomorrow',
      recipientId: viva.studentId,
      scheduledFor: subDays(viva.date, 1)
    });
  };


 