import { db } from "../db";

export type ProfileAnswers = {
  career: string;
  madlib: {
    when: string;
    focus: string;
    action: string;
  };
  memory: string;
};

type ProfileAnswersRow = {
  career: string;
  madlib_when: string;
  madlib_focus: string;
  madlib_action: string;
  memory: string;
};

const ensureProfileAnswersTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS profile_answers (
      user_id uuid PRIMARY KEY,
      career text NOT NULL,
      madlib_when text NOT NULL,
      madlib_focus text NOT NULL,
      madlib_action text NOT NULL,
      memory text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
};

const mapAnswers = (row: ProfileAnswersRow): ProfileAnswers => ({
  career: row.career,
  madlib: {
    when: row.madlib_when,
    focus: row.madlib_focus,
    action: row.madlib_action,
  },
  memory: row.memory,
});

export const getProfileAnswers = async (
  userId: string
): Promise<ProfileAnswers | null> => {
  await ensureProfileAnswersTable();
  const result = await db.query(
    `SELECT career, madlib_when, madlib_focus, madlib_action, memory
     FROM profile_answers
     WHERE user_id = $1`,
    [userId]
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  return mapAnswers(result.rows[0] as ProfileAnswersRow);
};

export const upsertProfileAnswers = async (
  userId: string,
  answers: ProfileAnswers
): Promise<ProfileAnswers> => {
  await ensureProfileAnswersTable();
  const result = await db.query(
    `INSERT INTO profile_answers
      (user_id, career, madlib_when, madlib_focus, madlib_action, memory)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id)
     DO UPDATE SET
      career = EXCLUDED.career,
      madlib_when = EXCLUDED.madlib_when,
      madlib_focus = EXCLUDED.madlib_focus,
      madlib_action = EXCLUDED.madlib_action,
      memory = EXCLUDED.memory,
      updated_at = now()
     RETURNING career, madlib_when, madlib_focus, madlib_action, memory`,
    [
      userId,
      answers.career,
      answers.madlib.when,
      answers.madlib.focus,
      answers.madlib.action,
      answers.memory,
    ]
  );

  return mapAnswers(result.rows[0] as ProfileAnswersRow);
};
