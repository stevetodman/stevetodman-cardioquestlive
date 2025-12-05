import React from "react";
import { render, screen } from "@testing-library/react";
import { SessionSummary } from "../SessionSummary";
import { TeamScore } from "../../hooks/useTeamScores";
import { IndividualScore } from "../../hooks/useIndividualScores";
import { QuestionStat } from "../SessionSummary";

describe("SessionSummary", () => {
  const teams: TeamScore[] = [
    { teamId: "a", teamName: "Team A", points: 300 },
    { teamId: "b", teamName: "Team B", points: 200 },
  ];
  const players: IndividualScore[] = [
    { userId: "u1", teamId: "a", teamName: "Team A", points: 150 },
    { userId: "u2", teamId: "b", teamName: "Team B", points: 120 },
  ];
  const questionStats: QuestionStat[] = [
    { questionId: "q1", questionIndex: 1, correctCount: 2, totalCount: 4, accuracyPct: 50 },
    { questionId: "q2", questionIndex: 2, correctCount: 1, totalCount: 5, accuracyPct: 20 },
    { questionId: "q3", questionIndex: 3, correctCount: 4, totalCount: 5, accuracyPct: 80 },
  ];

  test("renders core stats and most challenging questions", () => {
    render(
      <SessionSummary
        teams={teams}
        players={players}
        participantCount={5}
        overallAccuracy={0.6}
        totalQuestions={10}
        questionsAnsweredCount={3}
        questionsAnsweredPct={0.3}
        totalResponses={9}
        avgResponsesPerQuestion={3}
        questionStats={questionStats}
      />
    );

    const participantsCard = screen.getByText(/Participants/i).parentElement;
    expect(participantsCard).toHaveTextContent("5");
    const questionsCard = screen.getByText(/Questions in deck/i).parentElement;
    expect(questionsCard).toHaveTextContent("10");
    const answeredCard = screen.getByText(/Questions answered/i).parentElement;
    expect(answeredCard).toHaveTextContent("3");
    const responsesCard = screen.getByText(/Total responses/i).parentElement;
    expect(responsesCard).toHaveTextContent("9");
    expect(screen.getByText(/Team rankings/i)).toBeInTheDocument();
    expect(screen.getByText(/Top players/i)).toBeInTheDocument();
    // challenging: q2 has lowest accuracy
    expect(screen.getByText(/Question 2/)).toBeInTheDocument();
    expect(screen.getByText(/20%/)).toBeInTheDocument();
  });

  test("shows empty states gracefully", () => {
    render(
      <SessionSummary
        teams={[]}
        players={[]}
        participantCount={0}
        overallAccuracy={0}
        totalQuestions={0}
        questionsAnsweredCount={0}
        questionsAnsweredPct={0}
        totalResponses={0}
        avgResponsesPerQuestion={0}
        questionStats={[]}
      />
    );

    expect(screen.getAllByText(/No scores yet — waiting for answers/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/No question-level data yet/i)).toBeInTheDocument();
  });
});
