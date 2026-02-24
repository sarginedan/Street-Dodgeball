// AAA-Level AI Personality System
// Provides individuality and dynamic movement for each AI player

export function generateAIPersonality(index) {
  // 5 distinct archetypes with stat variation
  const archetypes = [
    {
      name: 'Sniper',
      aggression: 0.3 + Math.random() * 0.2,     // Cautious, waits for shots
      mobility: 0.6 + Math.random() * 0.2,        // Moderate movement
      reflexes: 0.8 + Math.random() * 0.15,       // Excellent reactions
      accuracy: 0.85 + Math.random() * 0.1,       // High accuracy
      trickChance: 0.2 + Math.random() * 0.15,    // Occasional tricks
      dodgeChance: 0.6 + Math.random() * 0.2,     // Prefers dodging
      catchChance: 0.5 + Math.random() * 0.2,     // Decent catches
      preferredRange: 'far',
      movementStyle: 'positioning',               // Stays in optimal spots
    },
    {
      name: 'Brawler',
      aggression: 0.8 + Math.random() * 0.15,
      mobility: 0.8 + Math.random() * 0.15,
      reflexes: 0.6 + Math.random() * 0.2,
      accuracy: 0.6 + Math.random() * 0.2,
      trickChance: 0.5 + Math.random() * 0.2,
      dodgeChance: 0.4 + Math.random() * 0.2,
      catchChance: 0.3 + Math.random() * 0.2,
      preferredRange: 'close',
      movementStyle: 'aggressive',                // Pushes forward constantly
    },
    {
      name: 'Trickster',
      aggression: 0.5 + Math.random() * 0.2,
      mobility: 0.75 + Math.random() * 0.2,
      reflexes: 0.7 + Math.random() * 0.2,
      accuracy: 0.5 + Math.random() * 0.2,
      trickChance: 0.75 + Math.random() * 0.2,    // Loves trick throws
      dodgeChance: 0.7 + Math.random() * 0.15,
      catchChance: 0.5 + Math.random() * 0.2,
      preferredRange: 'medium',
      movementStyle: 'unpredictable',             // Jukes and feints
    },
    {
      name: 'Defender',
      aggression: 0.2 + Math.random() * 0.2,
      mobility: 0.5 + Math.random() * 0.2,
      reflexes: 0.75 + Math.random() * 0.2,
      accuracy: 0.6 + Math.random() * 0.2,
      trickChance: 0.15 + Math.random() * 0.1,
      dodgeChance: 0.5 + Math.random() * 0.2,
      catchChance: 0.8 + Math.random() * 0.15,    // Catch specialist
      preferredRange: 'medium',
      movementStyle: 'defensive',                 // Stays back, protects
    },
    {
      name: 'AllArounder',
      aggression: 0.5 + Math.random() * 0.2,
      mobility: 0.65 + Math.random() * 0.2,
      reflexes: 0.65 + Math.random() * 0.2,
      accuracy: 0.65 + Math.random() * 0.2,
      trickChance: 0.4 + Math.random() * 0.2,
      dodgeChance: 0.5 + Math.random() * 0.2,
      catchChance: 0.5 + Math.random() * 0.2,
      preferredRange: 'medium',
      movementStyle: 'balanced',                  // Adapts to situation
    },
  ];
  
  // Assign archetype based on index for team diversity
  const archetype = Object.assign({}, archetypes[index % archetypes.length]);
  
  // Add individual quirks
  archetype.jukeFrequency = 1.2 + Math.random() * 1.5;    // Seconds between jukes (faster)
  archetype.repositionTime = 0.8 + Math.random() * 0.8;   // Time before repositioning (0.8-1.6s, was 1.5-3.0s)
  archetype.reactionDelay = 0.05 + (1 - archetype.reflexes) * 0.3; // Reaction time (faster)
  archetype.strafePreference = Math.random() > 0.5 ? 1 : -1; // Left/right preference
  
  return archetype;
}
