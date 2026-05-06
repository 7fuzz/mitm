use axum::{
    extract::State,
    Json,
    response::IntoResponse,
    http::StatusCode,
};
use serde_json::{json, Value};
use crate::state::SharedState;
use crate::models::Replacement;
use uuid::Uuid;

pub async fn get_replacements(State(state): State<SharedState>) -> impl IntoResponse {
    match sqlx::query_as::<sqlx::Sqlite, Replacement>("SELECT id, type, pattern, replacement, description, is_active, order_index, created_at, updated_at FROM replacements WHERE is_active = 1 ORDER BY type, order_index")
        .fetch_all(&state.db.pool)
        .await
    {
        Ok(rows) => {
            let mut grouped = serde_json::Map::new();
            grouped.insert("URL_REPLACEMENTS".to_string(), json!({}));
            grouped.insert("HEADER_VALUE_REPLACEMENTS".to_string(), json!({}));
            grouped.insert("HEADER_HOST_REPLACEMENTS".to_string(), json!({}));
            grouped.insert("BODY_KEY_REPLACEMENTS".to_string(), json!({}));
            grouped.insert("URL_PARAM_REPLACEMENTS".to_string(), json!({}));
            
            let mut ordered = Vec::new();
            
            for r in rows {
                if let Some(group) = grouped.get_mut(&r.r_type).and_then(|v| v.as_object_mut()) {
                    group.insert(r.pattern.clone(), json!(r.replacement));
                }
                ordered.push(json!({
                    "id": r.id,
                    "type": r.r_type,
                    "pattern": r.pattern,
                    "replacement": r.replacement,
                    "order_index": r.order_index,
                }));
            }
            
            Json(json!({
                "grouped": grouped,
                "ordered": ordered
            })).into_response()
        }
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

pub async fn post_replacements(
    State(state): State<SharedState>,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    let mut tx = state.db.pool.begin().await.unwrap();

    // Mark existing as inactive (bulk replace logic from python)
    let _ = sqlx::query("UPDATE replacements SET is_active = 0").execute(&mut *tx).await;

    if let Some(obj) = payload.as_object() {
        for (r_type, patterns) in obj {
            if let Some(patterns_obj) = patterns.as_object() {
                for (pattern, val) in patterns_obj {
                    let id = val.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_else(|| Uuid::new_v4().to_string());
                    let replacement = val.get("replacement").and_then(|v| v.as_str()).unwrap_or_else(|| val.as_str().unwrap_or(""));
                    let order_index = val.get("order_index").and_then(|v| v.as_i64()).unwrap_or(0) as i32;

                    let _ = sqlx::query("INSERT OR REPLACE INTO replacements (id, type, pattern, replacement, description, is_active, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, strftime('%s', 'now'), strftime('%s', 'now'))")
                        .bind(id)
                        .bind(r_type)
                        .bind(pattern)
                        .bind(replacement)
                        .bind(format!("Auto-saved {}", r_type))
                        .bind(order_index)
                        .execute(&mut *tx)
                        .await;
                }
            }
        }
    }

    tx.commit().await.unwrap();
    Json(json!({"success": true})).into_response()
}

pub async fn put_replacements(
    State(state): State<SharedState>,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    let mut tx = state.db.pool.begin().await.unwrap();

    if let Some(items) = payload.get("items").and_then(|v| v.as_array()) {
        for item in items {
            let id = item.get("id").and_then(|v| v.as_str());
            let order_index = item.get("order_index").and_then(|v| v.as_i64()).unwrap_or(0) as i32;

            if let Some(i) = id {
                let _ = sqlx::query("UPDATE replacements SET order_index = ?, updated_at = strftime('%s', 'now') WHERE id = ?")
                    .bind(order_index)
                    .bind(i)
                    .execute(&mut *tx)
                    .await;
            }
        }
    }

    tx.commit().await.unwrap();
    Json(json!({"success": true})).into_response()
}

pub async fn delete_replacement(
    State(state): State<SharedState>,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    let id = payload.get("id").and_then(|v| v.as_str());
    if let Some(i) = id {
        match sqlx::query("UPDATE replacements SET is_active = 0 WHERE id = ?").bind(i).execute(&state.db.pool).await {
            Ok(_) => Json(json!({"success": true})).into_response(),
            Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        }
    } else {
        StatusCode::BAD_REQUEST.into_response()
    }
}
