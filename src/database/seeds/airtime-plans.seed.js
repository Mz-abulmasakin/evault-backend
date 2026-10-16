export async function seed(knex) {
  const plans = [
    // =========================
    // MTN
    // =========================
    {
      provider: "ALRAHUZ",
      provider_plan_id: 13,
      network_id: 1,
      network_name: "MTN",
      amount: 100,
    },
    {
      provider: "ALRAHUZ",
      provider_plan_id: 2,
      network_id: 1,
      network_name: "MTN",
      amount: 200,
    },
    {
      provider: "ALRAHUZ",
      provider_plan_id: 3,
      network_id: 1,
      network_name: "MTN",
      amount: 500,
    },
    {
      provider: "ALRAHUZ",
      provider_plan_id: 20,
      network_id: 1,
      network_name: "MTN",
      amount: 1000,
    },

    // =========================
    // GLO
    // =========================
    {
      provider: "ALRAHUZ",
      provider_plan_id: 4,
      network_id: 2,
      network_name: "GLO",
      amount: 100,
    },
    {
      provider: "ALRAHUZ",
      provider_plan_id: 5,
      network_id: 2,
      network_name: "GLO",
      amount: 200,
    },
    {
      provider: "ALRAHUZ",
      provider_plan_id: 6,
      network_id: 2,
      network_name: "GLO",
      amount: 500,
    },
    {
      provider: "ALRAHUZ",
      provider_plan_id: 22,
      network_id: 2,
      network_name: "GLO",
      amount: 1000,
    },

    // =========================
    // 9MOBILE
    // =========================
    {
      provider: "ALRAHUZ",
      provider_plan_id: 7,
      network_id: 3,
      network_name: "9MOBILE",
      amount: 100,
    },
    {
      provider: "ALRAHUZ",
      provider_plan_id: 8,
      network_id: 3,
      network_name: "9MOBILE",
      amount: 200,
    },

    // =========================
    // AIRTEL
    // =========================
    {
      provider: "ALRAHUZ",
      provider_plan_id: 10,
      network_id: 4,
      network_name: "AIRTEL",
      amount: 100,
    },
    {
      provider: "ALRAHUZ",
      provider_plan_id: 11,
      network_id: 4,
      network_name: "AIRTEL",
      amount: 200,
    },
    {
      provider: "ALRAHUZ",
      provider_plan_id: 12,
      network_id: 4,
      network_name: "AIRTEL",
      amount: 500,
    },
    {
      provider: "ALRAHUZ",
      provider_plan_id: 21,
      network_id: 4,
      network_name: "AIRTEL",
      amount: 1000,
    },
  ];

  for (const plan of plans) {
    await knex("airtime_plans")
      .insert(plan)
      .onConflict(["provider", "provider_plan_id"])
      .merge({
        network_id: plan.network_id,
        network_name: plan.network_name,
        amount: plan.amount,
        is_active: true,
        updated_at: knex.fn.now(),
      });
  }
}