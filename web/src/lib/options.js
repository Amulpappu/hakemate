// Interest chips. Anything not listed can be typed under "Other".

export const INTEREST_GROUPS = [
  { group: 'Tech', items: ['AI', 'Web', 'Mobile Apps', 'Security', 'Open Source', 'Blockchain', 'AR/VR', 'Robotics', 'IoT', 'Cloud', 'Data Science', 'Gaming'] },
  { group: 'Problems to solve', items: ['Health', 'Agriculture', 'Education', 'FinTech', 'Climate', 'Smart Cities', 'Social Good', 'Accessibility', 'Women Safety', 'Transport'] },
];
export const ALL_INTERESTS = INTEREST_GROUPS.flatMap((g) => g.items);
