import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

class PredictionEngine:
    @staticmethod
    def prepare_demand_series(transactions: List[Dict], product_created_at: str) -> pd.Series:
        """
        Aggregates historical STOCK_OUT transactions by day, completing the timeline
        with 0-demand days from the creation date (or first transaction date) up to today.
        """
        if not transactions:
            return pd.Series(dtype=float)
            
        # Parse transactions into DataFrame
        df = pd.DataFrame(transactions)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df["date"] = df["timestamp"].dt.date
        
        # Filter for STOCK_OUT transactions
        df_out = df[df["transaction_type"] == "STOCK_OUT"]
        if df_out.empty:
            return pd.Series(dtype=float)
            
        # Aggregate demand by date
        daily_demand = df_out.groupby("date")["quantity"].sum().astype(float)
        
        # Build index from creation date (or earliest transaction) to today to fill missing days with 0
        start_date = pd.to_datetime(product_created_at).date()
        min_tx_date = daily_demand.index.min()
        if start_date > min_tx_date:
            start_date = min_tx_date
            
        end_date = datetime.utcnow().date()
        if start_date > end_date:
            start_date = end_date
            
        date_range = pd.date_range(start=start_date, end=end_date).date
        
        # Reindex series to include all dates and fill missing values with 0
        daily_demand = daily_demand.reindex(date_range, fill_value=0.0)
        return daily_demand

    @staticmethod
    def forecast_demand(demand_series: pd.Series) -> Tuple[float, float, Dict]:
        """
        Forecasts daily demand for the next day (1-day) and next 7-days using:
        1. Moving Average (14-day baseline)
        2. Linear Regression (slope/trend forecast)
        
        Returns:
            predicted_1_day: float (Linear Regression forecast)
            predicted_7_day: float (Linear Regression forecast sum)
            metrics: dict containing model details & baseline moving average
        """
        if demand_series.empty or len(demand_series) < 3:
            # Fallback for insufficient data
            avg = float(demand_series.mean()) if not demand_series.empty else 0.0
            return avg, avg * 7.0, {
                "model_used": "Baseline Mean",
                "daily_average": avg,
                "slope": 0.0,
                "insufficient_data": True,
                "data_points": len(demand_series),
                "forecast_days": [avg] * 7
            }
            
        n = len(demand_series)
        x = np.arange(n)
        y = demand_series.values
        
        # 14-day Moving Average baseline
        ma_window = min(14, n)
        moving_avg_daily = float(np.mean(y[-ma_window:]))
        
        # Fit Linear Regression: y = m*x + c
        m, c = np.polyfit(x, y, 1)
        
        # Forecast day T+1 to T+7
        forecast_days = []
        for i in range(1, 8):
            pred_day = m * (n - 1 + i) + c
            # Clip negative forecast to 0
            forecast_days.append(max(0.0, float(pred_day)))
            
        predicted_1_day = forecast_days[0]
        predicted_7_day = sum(forecast_days)
        
        # Calculate metrics if there is enough training data (e.g., > 10 days) for historical evaluation
        mae, rmse, mape = 0.0, 0.0, 0.0
        has_eval = False
        if n >= 7:
            # Simple walk-forward validation: train on n-7 days, predict last 7 days
            train_y = y[:-7]
            train_x = np.arange(len(train_y))
            test_y = y[-7:]
            
            if len(train_y) >= 2:
                m_val, c_val = np.polyfit(train_x, train_y, 1)
                val_preds = []
                for i in range(7):
                    val_pred = m_val * (len(train_y) + i) + c_val
                    val_preds.append(max(0.0, float(val_pred)))
                
                # Compute error metrics
                errors = np.abs(np.array(val_preds) - test_y)
                mae = float(np.mean(errors))
                rmse = float(np.sqrt(np.mean(errors ** 2)))
                
                # Avoid division by zero for MAPE
                non_zero_mask = test_y > 0
                if np.sum(non_zero_mask) > 0:
                    mape = float(np.mean(errors[non_zero_mask] / test_y[non_zero_mask]) * 100.0)
                else:
                    mape = 0.0
                has_eval = True
        
        metrics = {
            "model_used": "Linear Regression",
            "daily_moving_average_14d": moving_avg_daily,
            "slope": float(m),
            "intercept": float(c),
            "data_points": n,
            "insufficient_data": False,
            "forecast_days": forecast_days,
            "evaluation": {
                "available": has_eval,
                "mae": mae,
                "rmse": rmse,
                "mape": mape
            } if has_eval else {"available": False}
        }
        
        return predicted_1_day, predicted_7_day, metrics

    @classmethod
    def analyze_product(cls, product: Dict, transactions: List[Dict]) -> Dict:
        """
        Runs the full forecasting, stock-out risk, and restock recommendation
        analysis for a single product.
        """
        current_stock = float(product["current_stock"])
        reorder_level = float(product["reorder_level"])
        lead_time = float(product.get("lead_time_days", 3.0))
        safety_stock = float(product.get("safety_stock", 10.0))
        
        # Prepare demand timeseries
        demand_series = cls.prepare_demand_series(transactions, product["created_at"])
        
        # Run forecasting models
        pred_1d, pred_7d, metrics = cls.forecast_demand(demand_series)
        
        # Determine average daily demand for stock-out calculation (use moving average or LR prediction)
        # We use the average of the 7-day forecast to smooth out daily trend predictions
        daily_average_demand = pred_7d / 7.0
        
        # Calculate stock-out time
        if current_stock == 0:
            days_to_stock_out = 0.0
        elif daily_average_demand <= 0.001:
            days_to_stock_out = 999.0  # safe indefinitely / no demand
        else:
            days_to_stock_out = current_stock / daily_average_demand
            
        # Stock Risk Classification based on stockout timeline and reorder level
        if current_stock == 0 or days_to_stock_out <= 2.0:
            risk_level = "CRITICAL"
        elif days_to_stock_out <= 5.0:
            risk_level = "HIGH"
        elif days_to_stock_out <= 10.0:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"
            
        # Restock Recommendation Logic
        demand_during_lead_time = daily_average_demand * lead_time
        reorder_point = demand_during_lead_time + safety_stock
        restock_required = current_stock <= reorder_point
        
        target_stock = demand_during_lead_time + safety_stock + pred_7d
        recommended_qty = max(0.0, float(np.ceil(target_stock - current_stock)))
        
        # Enforce a minimum restock order size if restock is required and calculated order is small
        if restock_required and recommended_qty < 10.0:
            recommended_qty = 10.0
            
        # Calculate reorder timing
        if not restock_required:
            recommended_date_str = "N/A"
            reason_str = "Inventory levels are healthy and sufficient to meet forecasted demand."
        else:
            days_until_reorder = days_to_stock_out - lead_time
            if days_until_reorder <= 0:
                recommended_date_str = "IMMEDIATELY"
                if current_stock == 0:
                    reason_str = "Product is completely out of stock."
                else:
                    reason_str = f"Current stock ({current_stock:.0f}) will stock out in {days_to_stock_out:.1f} days, which is less than the lead time ({lead_time:.0f} days)."
            else:
                recommended_date_str = f"IN {int(np.ceil(days_until_reorder))} DAYS"
                reason_str = f"Current stock ({current_stock:.0f}) is below the safety reorder point ({reorder_point:.0f}). Order now to avoid stock-out."

        # Build timeseries data for charting
        historical_demand = []
        if not demand_series.empty:
            historical_demand = [
                {"date": str(d), "demand": float(v)} 
                for d, v in demand_series.items()
            ]
            
        fc_days = metrics.get("forecast_days", [pred_1d] * 7)
        forecast_demand = []
        today_date = datetime.utcnow().date()
        for i, val in enumerate(fc_days):
            future_date = today_date + timedelta(days=i + 1)
            forecast_demand.append({
                "date": future_date.isoformat(),
                "demand": val
            })

        return {
            "product_id": product["product_id"],
            "product_name": product["product_name"],
            "category": product["category"],
            "current_stock": current_stock,
            "reorder_level": reorder_level,
            "forecast_1_day": pred_1d,
            "forecast_7_day": pred_7d,
            "daily_average_demand": daily_average_demand,
            "days_to_stock_out": days_to_stock_out,
            "risk_level": risk_level,
            "restock_required": restock_required,
            "recommended_qty": recommended_qty,
            "recommended_date": recommended_date_str,
            "reorder_point": reorder_point,
            "historical_demand": historical_demand,
            "forecast_demand": forecast_demand,
            "metrics": metrics,
            "moving_average_daily_demand": metrics.get("daily_moving_average_14d") or metrics.get("daily_average", 0.0),
            "total_predicted_7_day_demand": pred_7d,
            "average_predicted_daily_demand": daily_average_demand,
            "forecast": [{"date": f["date"], "predicted_demand": f["demand"]} for f in forecast_demand],
            "estimated_days_until_stockout": days_to_stock_out,
            "predicted_7_day_demand": pred_7d,
            "recommended_reorder_quantity": recommended_qty,
            "recommended_reorder_timing": recommended_date_str,
            "reason": reason_str
        }
