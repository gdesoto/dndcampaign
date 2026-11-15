-- Exhaustion stores a level (1-6) in remaining; clamp rows saved as round counters.
UPDATE `EncounterCondition` SET `remaining` = MIN(MAX(COALESCE(`remaining`, 1), 1), 6), `duration` = NULL WHERE lower(trim(`name`)) = 'exhaustion';
