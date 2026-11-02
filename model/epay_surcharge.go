package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// EpayPaySurcharge records the pre-surcharge price of an epay order. Epay
// orders pay a random sub-yuan surcharge so the gateway can tell same-amount
// orders apart; the surcharge is credited to the user as well, scaled by the
// same price the base amount was sold at.
type EpayPaySurcharge struct {
	TradeNo   string  `json:"trade_no" gorm:"primaryKey;type:varchar(255)"`
	BaseMoney float64 `json:"base_money"`
	CreatedAt int64   `json:"created_at" gorm:"bigint"`
}

func CreateEpayPaySurcharge(tradeNo string, baseMoney float64) error {
	return DB.Create(&EpayPaySurcharge{TradeNo: tradeNo, BaseMoney: baseMoney, CreatedAt: common.GetTimestamp()}).Error
}

// epayCreditedQuota returns the quota for an epay order: baseQuota scaled up
// by paid money / pre-surcharge money. Orders without a surcharge record (or
// with an inconsistent one) are credited baseQuota.
func epayCreditedQuota(tx *gorm.DB, topUp *TopUp, baseQuota int) (int, error) {
	var record EpayPaySurcharge
	err := tx.Where("trade_no = ?", topUp.TradeNo).First(&record).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return baseQuota, nil
	}
	if err != nil {
		return 0, err
	}
	if record.BaseMoney <= 0 || topUp.Money <= record.BaseMoney {
		return baseQuota, nil
	}
	scaled := decimal.NewFromInt(int64(baseQuota)).
		Mul(decimal.NewFromFloat(topUp.Money)).
		Div(decimal.NewFromFloat(record.BaseMoney)).
		Floor()
	return common.WalletQuotaFromDecimalStrict(scaled)
}
