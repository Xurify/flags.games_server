export const validateUsername = (username: string): { valid: boolean; error?: string } => {
  if (typeof username !== 'string') {
    return { valid: false, error: 'Username must be a string' };
  }
  
  if (username.length === 0) {
    return { valid: false, error: 'Username cannot be empty' };
  }
  
  if (username.length > 20) {
    return { valid: false, error: 'Username cannot exceed 20 characters' };
  }

  if (username.length < 2) {
    return { valid: false, error: 'Username must be at least 2 characters' };
  }
  
  const validUsernameRegex = /^[a-zA-Z0-9\s\-_\.]+$/;
  if (!validUsernameRegex.test(username)) {
    return { valid: false, error: 'Username contains invalid characters' };
  }

  const inappropriateWords = ['admin', 'moderator', 'bot', 'system', 'null', 'undefined'];
  const lowerUsername = username.toLowerCase().trim();
  
  for (const word of inappropriateWords) {
    if (lowerUsername.includes(word)) {
      return { valid: false, error: 'Username contains inappropriate content' };
    }
  }

  if (username.trim().length === 0) {
    return { valid: false, error: 'Username cannot be only spaces' };
  }
  
  return { valid: true };
};

export const validateRoomName = (roomName: string): { valid: boolean; error?: string } => {
  if (typeof roomName !== 'string') {
    return { valid: false, error: 'Room name must be a string' };
  }
  
  if (roomName.length === 0) {
    return { valid: false, error: 'Room name cannot be empty' };
  }
  
  if (roomName.length > 50) {
    return { valid: false, error: 'Room name cannot exceed 50 characters' };
  }

  if (roomName.length < 3) {
    return { valid: false, error: 'Room name must be at least 3 characters' };
  }

  const validRoomNameRegex = /^[a-zA-Z0-9\s\-_\.!]+$/;
  if (!validRoomNameRegex.test(roomName)) {
    return { valid: false, error: 'Room name contains invalid characters' };
  }

  if (roomName.trim().length === 0) {
    return { valid: false, error: 'Room name cannot be only spaces' };
  }
  
  return { valid: true };
};

export const validateDifficulty = (difficulty: string): { valid: boolean; error?: string } => {
  const validDifficulties = ['easy', 'medium', 'hard', 'expert'];
  
  if (!validDifficulties.includes(difficulty)) {
    return { valid: false, error: 'Invalid difficulty level' };
  }
  
  return { valid: true };
};

export const validateRoomSettings = (settings: any): { valid: boolean; error?: string } => {
  if (!settings || typeof settings !== 'object') {
    return { valid: false, error: 'Settings must be an object' };
  }

  if (settings.difficulty) {
    const difficultyValidation = validateDifficulty(settings.difficulty);
    if (!difficultyValidation.valid) {
      return difficultyValidation;
    }
  }

  // if (settings.questionCount !== undefined) {
  //   if (typeof settings.questionCount !== 'number' || 
  //       settings.questionCount < 5 || 
  //       settings.questionCount > 50) {
  //     return { valid: false, error: 'Question count must be between 5 and 50' };
  //   }
  // }

  if (settings.timePerQuestion !== undefined) {
    if (typeof settings.timePerQuestion !== 'number' || 
        settings.timePerQuestion < 10 || 
        settings.timePerQuestion > 120) {
      return { valid: false, error: 'Time per question must be between 10 and 120 seconds' };
    }
  }

  const booleanSettings = ['allowSpectators', 'showLeaderboard'];
  for (const setting of booleanSettings) {
    if (settings[setting] !== undefined && typeof settings[setting] !== 'boolean') {
      return { valid: false, error: `${setting} must be a boolean` };
    }
  }

  return { valid: true };
};

export const validateInviteCode = (inviteCode: string): { valid: boolean; error?: string } => {
  if (typeof inviteCode !== 'string') {
    return { valid: false, error: 'Invite code must be a string' };
  }

  if (inviteCode.length !== 6) {
    return { valid: false, error: 'Invite code must be 6 characters' };
  }

  // Check for valid characters (letters and numbers only)
  const validInviteCodeRegex = /^[A-Z0-9]{6}$/;
  if (!validInviteCodeRegex.test(inviteCode)) {
    return { valid: false, error: 'Invalid invite code format' };
  }

  return { valid: true };
};

export const validatePasscode = (passcode: string): { valid: boolean; error?: string } => {
  if (typeof passcode !== 'string') {
    return { valid: false, error: 'Passcode must be a string' };
  }

  if (passcode.length < 4 || passcode.length > 20) {
    return { valid: false, error: 'Passcode must be between 4 and 20 characters' };
  }

  return { valid: true };
};

export const sanitizeString = (str: string): string => {
  return str.trim().replace(/[<>]/g, '');
};

export const validateUserId = (userId: string): { valid: boolean; error?: string } => {
  if (typeof userId !== 'string') {
    return { valid: false, error: 'User ID must be a string' };
  }

  if (userId.length === 0) {
    return { valid: false, error: 'User ID cannot be empty' };
  }

  if (userId.length > 50) {
    return { valid: false, error: 'User ID too long' };
  }

  return { valid: true };
};