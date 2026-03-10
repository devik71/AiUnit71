use spacetimedb::{table, reducer, ReducerContext};
use log;

#[table(name = "mco_state", public)]
pub struct McoState {
    #[primary_key]
    pub id: u64,
    pub client_name: String,
    pub primary_audience: String,
    pub brand_voice: String,
    pub allow_partial_delivery: bool,
}

#[table(name = "mission_budget", public)]
pub struct MissionBudget {
    #[primary_key]
    pub id: u64,
    pub total: u64,
    pub spendable: u64,
    pub reserve: u64,
    pub spent: u64,
}

#[table(name = "agent_room", public)]
pub struct AgentRoom {
    #[primary_key]
    pub room_id: String,
    pub status: String,
    pub current_phase: String,
    pub strikes: u8,
}

#[table(name = "deliverable", public)]
pub struct Deliverable {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub room_id: String,
    pub name: String,
    pub is_mandatory: bool,
    pub score: u8,
    pub s3_asset_url: Option<String>,
}

#[reducer(init)]
pub fn init(ctx: &ReducerContext) {
    McoState::insert(ctx, McoState {
        id: 0,
        client_name: "TBD".to_string(),
        primary_audience: "TBD".to_string(),
        brand_voice: "TBD".to_string(),
        allow_partial_delivery: true,
    }).unwrap();

    MissionBudget::insert(ctx, MissionBudget {
        id: 0,
        total: 800,
        reserve: 160,
        spendable: 640,
        spent: 0,
    }).unwrap();
}

#[reducer]
pub fn start_phase(ctx: &ReducerContext, room_id: String, estimated_cost: u64, phase_name: String) -> Result<(), String> {
    let mut room = AgentRoom::filter_by_room_id(ctx, &room_id)
        .next()
        .unwrap_or(AgentRoom {
            room_id: room_id.clone(),
            status: "idle".to_string(),
            current_phase: phase_name.clone(),
            strikes: 0,
        });

    if room.status == "isolated" {
        return Err(format!("Room {} is isolated.", room_id));
    }

    let mut budget = MissionBudget::filter_by_id(ctx, &0).next().unwrap();
    let available = budget.spendable.saturating_sub(budget.spent);

    if estimated_cost > available {
        return Err("Circuit breaker activated".to_string());
    }

    budget.spent += estimated_cost;
    MissionBudget::update_by_id(ctx, &0, budget).unwrap();

    room.status = "active".to_string();
    room.current_phase = phase_name;
    AgentRoom::update_by_room_id(ctx, &room_id, room).unwrap();

    Ok(())
}

#[reducer]
pub fn fail_task(ctx: &ReducerContext, room_id: String, error_msg: String) -> Result<(), String> {
    let mut room = AgentRoom::filter_by_room_id(ctx, &room_id)
        .next()
        .ok_or_else(|| format!("Room {} not found", room_id))?;

    room.strikes += 1;

    if room.strikes >= 3 {
        room.status = "isolated".to_string();
    } else {
        room.status = "idle".to_string();
    }

    AgentRoom::update_by_room_id(ctx, &room_id, room).unwrap();
    Ok(())
}

#[reducer]
pub fn update_mco(ctx: &ReducerContext, property: String, new_value: String) -> Result<(), String> {
    let mut mco = McoState::filter_by_id(ctx, &0).next().unwrap();
    match property.as_str() {
        "brand_voice" => mco.brand_voice = new_value,
        "primary_audience" => mco.primary_audience = new_value,
        "client_name" => mco.client_name = new_value,
        _ => return Err(format!("Unknown property {}", property)),
    }
    McoState::update_by_id(ctx, &0, mco).unwrap();
    Ok(())
}
