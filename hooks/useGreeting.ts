export function useGreeting(): { sublabel: string; title: string } {
  const hour = new Date().getHours();

  if (hour < 12) {
    return { sublabel: 'Good morning', title: 'What are you cooking today?' };
  }
  if (hour < 17) {
    return { sublabel: 'Good afternoon', title: 'Ready to cook something?' };
  }
  return { sublabel: 'Good evening', title: "What's for dinner?" };
}
