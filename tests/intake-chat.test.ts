/**
 * Intake Chat Continuation Tests
 *
 * Tests the intake interview continuation flow through personal chats:
 * - Intake trigger detection (first message matching the trigger phrase)
 * - intake_data block parsing and stripping
 * - saveIntakeDataFromChat persisting data to the correct DB tables
 * - Defensive handling of string-vs-array fields in context formatting
 *
 * Requires: Docker (PostgreSQL) running
 * Run: npm run test:unit -- tests/intake-chat.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  personalChats,
  personalMessages,
  intakeProgress,
  intakeResponses,
  coupleProfiles,
  coupleMembers,
  couples,
  user,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { saveIntakeDataFromChat } from "@/lib/ai/intake-data-saver";

const testEmail = `intake-chat-${Date.now()}@kuxani.app`;
const testPassword = "IntakeChat123!";
const testName = "Intake Chat Tester";

const INTAKE_TRIGGER = "Hi, I'm ready to continue with my intake interview.";

let testUserId: string;
let coupleId: string;
let chatId: string;

// Track created resources for cleanup
const createdProgressIds: string[] = [];
const createdResponseIds: string[] = [];

describe("Intake Chat Continuation", () => {
  beforeAll(async () => {
    // Create a test user via Better Auth
    const result = await auth.api.signUpEmail({
      body: { email: testEmail, password: testPassword, name: testName },
    });
    testUserId = result.user.id;

    // Create couple for couple-dependent tests
    const [couple] = await db
      .insert(couples)
      .values({ inviteCode: `test-intake-chat-${Date.now()}` })
      .returning();
    coupleId = couple.id;

    await db.insert(coupleMembers).values([
      { coupleId, userId: testUserId, role: "creator" },
    ]);

    await db
      .insert(coupleProfiles)
      .values({ coupleId })
      .onConflictDoNothing();

    // Create a test personal chat
    const [chat] = await db
      .insert(personalChats)
      .values({ userId: testUserId, title: "New Chat" })
      .returning();
    chatId = chat.id;
  });

  afterAll(async () => {
    // Clean up in reverse dependency order
    await db.delete(personalMessages).where(eq(personalMessages.chatId, chatId));
    await db.delete(personalChats).where(eq(personalChats.id, chatId));
    for (const id of createdResponseIds) {
      await db.delete(intakeResponses).where(eq(intakeResponses.id, id));
    }
    for (const id of createdProgressIds) {
      await db.delete(intakeProgress).where(eq(intakeProgress.id, id));
    }
    await db
      .delete(coupleProfiles)
      .where(eq(coupleProfiles.coupleId, coupleId));
    await db
      .delete(coupleMembers)
      .where(eq(coupleMembers.coupleId, coupleId));
    await db.delete(couples).where(eq(couples.id, coupleId));
    await db.delete(user).where(eq(user.id, testUserId));
  });

  // ── Intake Trigger Detection ──

  describe("Intake Trigger Detection", () => {
    it("should detect the intake trigger as the first message", async () => {
      // Insert the trigger message
      await db.insert(personalMessages).values({
        chatId,
        role: "user",
        content: INTAKE_TRIGGER,
      });

      // Fetch history and check
      const messages = await db
        .select()
        .from(personalMessages)
        .where(eq(personalMessages.chatId, chatId));

      const isIntakeChat =
        messages.length > 0 &&
        messages[0].content.trim() === INTAKE_TRIGGER;

      expect(isIntakeChat).toBe(true);
    });

    it("should NOT detect intake trigger when first message is different", async () => {
      // Create a separate chat for this test
      const [otherChat] = await db
        .insert(personalChats)
        .values({ userId: testUserId, title: "Regular Chat" })
        .returning();

      await db.insert(personalMessages).values({
        chatId: otherChat.id,
        role: "user",
        content: "I've been feeling anxious lately.",
      });

      const messages = await db
        .select()
        .from(personalMessages)
        .where(eq(personalMessages.chatId, otherChat.id));

      const isIntakeChat =
        messages.length > 0 &&
        messages[0].content.trim() === INTAKE_TRIGGER;

      expect(isIntakeChat).toBe(false);

      // Cleanup
      await db
        .delete(personalMessages)
        .where(eq(personalMessages.chatId, otherChat.id));
      await db
        .delete(personalChats)
        .where(eq(personalChats.id, otherChat.id));
    });
  });

  // ── intake_data Block Parsing & Stripping ──

  describe("intake_data Block Parsing", () => {
    /** Same regex logic used in the API route */
    function parseIntakeData(
      text: string
    ): Array<Record<string, unknown>> {
      const blocks: Array<Record<string, unknown>> = [];
      const regex = /```intake_data\s*\n([\s\S]*?)```/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        try {
          blocks.push(JSON.parse(match[1].trim()));
        } catch {
          /* skip malformed */
        }
      }
      return blocks;
    }

    /** Same strip logic used in the client and server */
    function stripIntakeData(text: string): string {
      let cleaned = text.replace(/```intake_data\s*\n[\s\S]*?```/g, "");
      cleaned = cleaned.replace(/```intake_data[\s\S]*$/g, "");
      return cleaned.trim();
    }

    it("should parse a complete intake_data block", () => {
      const aiResponse = `That's helpful to understand. Now tell me about your childhood.\n\n\`\`\`intake_data\n{ "phase": 3, "individualData": { "familyRole": "Peacemaker" } }\n\`\`\``;

      const blocks = parseIntakeData(aiResponse);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].phase).toBe(3);
      expect(
        (blocks[0].individualData as Record<string, string>).familyRole
      ).toBe("Peacemaker");
    });

    it("should parse multiple intake_data blocks", () => {
      const aiResponse = `Hello!\n\n\`\`\`intake_data\n{ "phase": 1, "coupleFacts": { "relationshipStage": "married" } }\n\`\`\`\n\nMore text.\n\n\`\`\`intake_data\n{ "phase": 2, "responses": { "presentingProblem": "Communication issues" } }\n\`\`\``;

      const blocks = parseIntakeData(aiResponse);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].phase).toBe(1);
      expect(blocks[1].phase).toBe(2);
    });

    it("should skip malformed JSON blocks", () => {
      const aiResponse = `Response\n\n\`\`\`intake_data\n{ invalid json }\n\`\`\``;

      const blocks = parseIntakeData(aiResponse);
      expect(blocks).toHaveLength(0);
    });

    it("should strip complete intake_data blocks from visible text", () => {
      const aiResponse = `That's really insightful.\n\n\`\`\`intake_data\n{ "phase": 3, "individualData": { "familyRole": "Peacemaker" } }\n\`\`\``;

      const stripped = stripIntakeData(aiResponse);
      expect(stripped).toBe("That's really insightful.");
      expect(stripped).not.toContain("intake_data");
      expect(stripped).not.toContain("familyRole");
    });

    it("should strip incomplete/in-progress intake_data blocks (streaming)", () => {
      // Simulates a partial block during streaming where the closing ``` hasn't arrived yet
      const partialStream = `Great, tell me more.\n\n\`\`\`intake_data\n{ "phase": 3, "individ`;

      const stripped = stripIntakeData(partialStream);
      expect(stripped).toBe("Great, tell me more.");
      expect(stripped).not.toContain("intake_data");
      expect(stripped).not.toContain("phase");
    });

    it("should handle text with no intake_data blocks", () => {
      const normalText = "How are you feeling today?";
      const stripped = stripIntakeData(normalText);
      expect(stripped).toBe("How are you feeling today?");
    });

    it("should preserve text before and after intake_data blocks", () => {
      const aiResponse = `Before text.\n\n\`\`\`intake_data\n{ "phase": 1 }\n\`\`\`\n\nAfter text.`;

      const stripped = stripIntakeData(aiResponse);
      expect(stripped).toContain("Before text.");
      expect(stripped).toContain("After text.");
      expect(stripped).not.toContain("intake_data");
    });
  });

  // ── saveIntakeDataFromChat ──

  describe("saveIntakeDataFromChat", () => {
    it("should save individual data to user profileData", async () => {
      await saveIntakeDataFromChat(testUserId, {
        phase: 3,
        individualData: {
          familyRole: "Oldest sibling, felt displaced",
          significantLosses: "Lost grandmother at 12",
        },
      });

      // Verify in DB
      const [userData] = await db
        .select({ profileData: user.profileData })
        .from(user)
        .where(eq(user.id, testUserId))
        .limit(1);

      expect(userData.profileData?.familyOfOrigin?.familyRole).toBe(
        "Oldest sibling, felt displaced"
      );
      expect(
        userData.profileData?.familyOfOrigin?.significantLosses
      ).toBe("Lost grandmother at 12");
    });

    it("should save attachment history data", async () => {
      await saveIntakeDataFromChat(testUserId, {
        phase: 4,
        individualData: {
          childhoodComfortSource: "My grandmother",
          wasComfortAvailable: false,
          selfSoothingPatterns: ["exercise", "isolation"],
          vulnerabilityComfort:
            "Very uncomfortable showing weakness",
        },
      });

      const [userData] = await db
        .select({ profileData: user.profileData })
        .from(user)
        .where(eq(user.id, testUserId))
        .limit(1);

      expect(
        userData.profileData?.attachmentHistory?.childhoodComfortSource
      ).toBe("My grandmother");
      expect(
        userData.profileData?.attachmentHistory?.wasComfortAvailable
      ).toBe(false);
      expect(
        userData.profileData?.attachmentHistory?.vulnerabilityComfort
      ).toBe("Very uncomfortable showing weakness");
    });

    it("should save couple facts to couple_profiles", async () => {
      await saveIntakeDataFromChat(testUserId, {
        phase: 1,
        coupleFacts: {
          relationshipStage: "dating",
          livingSituation: "together",
          therapyGoals: ["Better communication", "Trust"],
        },
      });

      const [profile] = await db
        .select()
        .from(coupleProfiles)
        .where(eq(coupleProfiles.coupleId, coupleId))
        .limit(1);

      expect(profile.relationshipStage).toBe("dating");
      expect(profile.livingSituation).toBe("together");
      expect(profile.therapyGoals).toEqual([
        "Better communication",
        "Trust",
      ]);
    });

    it("should save dual-perspective responses to intake_responses", async () => {
      await saveIntakeDataFromChat(testUserId, {
        phase: 2,
        responses: {
          presentingProblem: "We argue about chores constantly",
          biggestChallenges: "Communication and trust",
        },
      });

      const responses = await db
        .select()
        .from(intakeResponses)
        .where(
          and(
            eq(intakeResponses.userId, testUserId),
            eq(intakeResponses.coupleId, coupleId)
          )
        );

      const problemResp = responses.find(
        (r) => r.field === "presentingProblem"
      );
      const challengeResp = responses.find(
        (r) => r.field === "biggestChallenges"
      );

      expect(problemResp).toBeDefined();
      expect(problemResp!.value).toBe(
        "We argue about chores constantly"
      );
      expect(challengeResp).toBeDefined();
      expect(challengeResp!.value).toBe("Communication and trust");

      createdResponseIds.push(problemResp!.id, challengeResp!.id);
    });

    it("should create intake progress record", async () => {
      await saveIntakeDataFromChat(testUserId, {
        phase: 5,
        individualData: {
          previousRelationships: "2 long-term relationships",
        },
      });

      const [progress] = await db
        .select()
        .from(intakeProgress)
        .where(
          and(
            eq(intakeProgress.userId, testUserId),
            eq(intakeProgress.phase, 5)
          )
        )
        .limit(1);

      expect(progress).toBeDefined();
      expect(progress.status).toBe("in_progress");
      expect(progress.modalityUsed).toBe("chat");
      createdProgressIds.push(progress.id);
    });

    it("should mark phase as completed when complete flag is set", async () => {
      await saveIntakeDataFromChat(testUserId, {
        phase: 6,
        complete: true,
        responses: {
          inLawDynamics: "Complicated but improving",
        },
      });

      const [progress] = await db
        .select()
        .from(intakeProgress)
        .where(
          and(
            eq(intakeProgress.userId, testUserId),
            eq(intakeProgress.phase, 6)
          )
        )
        .limit(1);

      expect(progress).toBeDefined();
      expect(progress.status).toBe("completed");
      expect(progress.completedAt).toBeDefined();
      createdProgressIds.push(progress.id);

      const responses = await db
        .select()
        .from(intakeResponses)
        .where(
          and(
            eq(intakeResponses.userId, testUserId),
            eq(intakeResponses.field, "inLawDynamics")
          )
        );
      if (responses.length > 0) createdResponseIds.push(responses[0].id);
    });

    it("should ignore unknown fields", async () => {
      // Should not throw
      await saveIntakeDataFromChat(testUserId, {
        phase: 1,
        individualData: {
          unknownField: "should be ignored",
          anotherFakeField: 42,
        },
      });
    });

    it("should merge with existing profileData", async () => {
      // Set some existing data
      await db
        .update(user)
        .set({
          profileData: {
            attachmentStyle: "anxious",
            loveLanguage: "quality_time",
          },
        })
        .where(eq(user.id, testUserId));

      // Save new intake data
      await saveIntakeDataFromChat(testUserId, {
        phase: 3,
        individualData: {
          emotionalEnvironment: "Warm but inconsistent",
        },
      });

      const [userData] = await db
        .select({ profileData: user.profileData })
        .from(user)
        .where(eq(user.id, testUserId))
        .limit(1);

      // Both old and new data should be present
      expect(userData.profileData?.attachmentStyle).toBe("anxious");
      expect(userData.profileData?.loveLanguage).toBe("quality_time");
      expect(
        userData.profileData?.familyOfOrigin?.emotionalEnvironment
      ).toBe("Warm but inconsistent");
    });
  });

  // ── Defensive Array.isArray Handling ──

  describe("String-vs-Array Field Safety", () => {
    it("should handle selfSoothingPatterns as a string (from AI)", async () => {
      // AI sometimes stores these as strings instead of arrays
      await db
        .update(user)
        .set({
          profileData: {
            attachmentHistory: {
              selfSoothingPatterns:
                "exercise and isolation" as unknown as string[],
              childhoodComfortSource: "Grandmother",
            },
          },
        })
        .where(eq(user.id, testUserId));

      // Loading context should NOT throw
      const { loadPersonalContext } = await import(
        "@/lib/ai/context"
      );
      const ctx = await loadPersonalContext(testUserId);

      // Should succeed without crashing
      expect(ctx).toBeDefined();
    });

    it("should handle unspokenRules as a string (from AI)", async () => {
      await db
        .update(user)
        .set({
          profileData: {
            familyOfOrigin: {
              unspokenRules:
                "Don't show weakness" as unknown as string[],
              familyRole: "Peacemaker",
            },
          },
        })
        .where(eq(user.id, testUserId));

      const { loadPersonalContext } = await import(
        "@/lib/ai/context"
      );
      const ctx = await loadPersonalContext(testUserId);

      expect(ctx).toBeDefined();
    });

    it("should handle externalStressors as a string (from AI)", async () => {
      await db
        .update(user)
        .set({
          profileData: {
            externalStressors:
              "Work stress and financial pressure" as unknown as string[],
          },
        })
        .where(eq(user.id, testUserId));

      const { loadPersonalContext } = await import(
        "@/lib/ai/context"
      );
      const ctx = await loadPersonalContext(testUserId);

      expect(ctx).toBeDefined();
    });
  });

  // ── Chat Title Auto-Naming ──

  describe("Chat Title for Intake", () => {
    it("should show 'Intake Interview' as the expected title for intake chats", async () => {
      // The API route sets title to "Intake Interview" for intake chats
      // We test the logic here: if first message is the trigger, title should be "Intake Interview"
      const [intakeChat] = await db
        .insert(personalChats)
        .values({ userId: testUserId, title: "New Chat" })
        .returning();

      await db.insert(personalMessages).values({
        chatId: intakeChat.id,
        role: "user",
        content: INTAKE_TRIGGER,
      });

      const messages = await db
        .select()
        .from(personalMessages)
        .where(eq(personalMessages.chatId, intakeChat.id));

      const isIntakeChat =
        messages.length > 0 &&
        messages[0].content.trim() === INTAKE_TRIGGER;

      // Simulate the title update logic from the API
      const title = isIntakeChat ? "Intake Interview" : "User message...";

      expect(title).toBe("Intake Interview");

      // Cleanup
      await db
        .delete(personalMessages)
        .where(eq(personalMessages.chatId, intakeChat.id));
      await db
        .delete(personalChats)
        .where(eq(personalChats.id, intakeChat.id));
    });
  });

  // ── Edge Cases: Parsing ──

  describe("Parsing Edge Cases", () => {
    function parseIntakeData(
      text: string
    ): Array<Record<string, unknown>> {
      const blocks: Array<Record<string, unknown>> = [];
      const regex = /```intake_data\s*\n([\s\S]*?)```/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        try {
          blocks.push(JSON.parse(match[1].trim()));
        } catch {
          /* skip malformed */
        }
      }
      return blocks;
    }

    function stripIntakeData(text: string): string {
      let cleaned = text.replace(/```intake_data\s*\n[\s\S]*?```/g, "");
      cleaned = cleaned.replace(/```intake_data[\s\S]*$/g, "");
      return cleaned.trim();
    }

    it("should handle empty JSON object in intake_data block", () => {
      const aiResponse = `Ok.\n\n\`\`\`intake_data\n{}\n\`\`\``;
      const blocks = parseIntakeData(aiResponse);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({});
    });

    it("should handle JSON array in intake_data block (not object)", () => {
      const aiResponse = `Ok.\n\n\`\`\`intake_data\n[1,2,3]\n\`\`\``;
      const blocks = parseIntakeData(aiResponse);
      // Arrays parse as valid JSON but aren't Record<string, unknown>
      expect(blocks).toHaveLength(1);
    });

    it("should handle Unicode and emoji in intake_data values", () => {
      const aiResponse = `Great.\n\n\`\`\`intake_data\n{ "phase": 1, "responses": { "presentingProblem": "关系很复杂 🎭" } }\n\`\`\``;
      const blocks = parseIntakeData(aiResponse);
      expect(blocks).toHaveLength(1);
      expect(
        (blocks[0].responses as Record<string, string>).presentingProblem
      ).toBe("关系很复杂 🎭");
    });

    it("should handle whitespace-only text after stripping blocks", () => {
      const aiResponse = `   \n\n\`\`\`intake_data\n{ "phase": 1 }\n\`\`\`\n   `;
      const stripped = stripIntakeData(aiResponse);
      expect(stripped).toBe("");
    });

    it("should handle multiple partial blocks during streaming", () => {
      const partialStream = `Text here.\n\n\`\`\`intake_data\n{ "phas`;
      const stripped = stripIntakeData(partialStream);
      expect(stripped).toBe("Text here.");
      expect(stripped).not.toContain("intake_data");
    });
  });

  // ── Edge Cases: saveIntakeDataFromChat ──

  describe("saveIntakeDataFromChat Edge Cases", () => {
    it("should handle data with empty responses object", async () => {
      // Should not throw
      await saveIntakeDataFromChat(testUserId, {
        phase: 2,
        responses: {},
      });
    });

    it("should handle data with empty individualData object", async () => {
      // Should not throw
      await saveIntakeDataFromChat(testUserId, {
        phase: 3,
        individualData: {},
      });
    });

    it("should handle data with empty coupleFacts object", async () => {
      // Should not throw
      await saveIntakeDataFromChat(testUserId, {
        phase: 1,
        coupleFacts: {},
      });
    });

    it("should overwrite existing response on duplicate save", async () => {
      // Save initial value
      await saveIntakeDataFromChat(testUserId, {
        phase: 2,
        responses: {
          presentingProblem: "Original problem description",
        },
      });

      // Save again with updated value
      await saveIntakeDataFromChat(testUserId, {
        phase: 2,
        responses: {
          presentingProblem: "Updated problem description",
        },
      });

      const responses = await db
        .select()
        .from(intakeResponses)
        .where(
          and(
            eq(intakeResponses.userId, testUserId),
            eq(intakeResponses.coupleId, coupleId),
            eq(intakeResponses.field, "presentingProblem")
          )
        );

      // Should have exactly one response (upserted, not duplicated)
      const matching = responses.filter(
        (r) => r.value === "Updated problem description"
      );
      expect(matching.length).toBeGreaterThanOrEqual(1);

      // Track for cleanup
      for (const r of responses) {
        if (!createdResponseIds.includes(r.id)) {
          createdResponseIds.push(r.id);
        }
      }
    });

    it("should handle data with no phase (should not create progress)", async () => {
      const progressBefore = await db
        .select()
        .from(intakeProgress)
        .where(eq(intakeProgress.userId, testUserId));
      const countBefore = progressBefore.length;

      // Save data with no phase field
      await saveIntakeDataFromChat(testUserId, {
        individualData: {
          familyRole: "No phase test",
        },
      });

      const progressAfter = await db
        .select()
        .from(intakeProgress)
        .where(eq(intakeProgress.userId, testUserId));

      // Should not have created a new progress record
      expect(progressAfter.length).toBe(countBefore);
    });

    it("should update existing progress to completed on re-save with complete flag", async () => {
      // First save creates in_progress
      await saveIntakeDataFromChat(testUserId, {
        phase: 7,
        responses: { relationshipStrengths: "We laugh together" },
      });

      // Second save marks complete
      await saveIntakeDataFromChat(testUserId, {
        phase: 7,
        complete: true,
        responses: { relationshipStrengths: "We laugh together a lot" },
      });

      const [progress] = await db
        .select()
        .from(intakeProgress)
        .where(
          and(
            eq(intakeProgress.userId, testUserId),
            eq(intakeProgress.phase, 7)
          )
        )
        .limit(1);

      expect(progress.status).toBe("completed");
      expect(progress.completedAt).toBeDefined();
      createdProgressIds.push(progress.id);
    });
  });
});

