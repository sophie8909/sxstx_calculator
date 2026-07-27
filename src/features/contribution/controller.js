export function prefillContributionForm(form, context) {
  if (!form) return;
  const playerInput = form.querySelector('[name="player_number"], #player-number');
  const seasonInput = form.querySelector('[name="season"], #season');
  if (playerInput && context.playerNumber) playerInput.value = context.playerNumber;
  if (seasonInput && context.seasonId) seasonInput.value = context.seasonId;
}
