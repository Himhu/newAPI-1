package controller

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/shopspring/decimal"
)

// The epay gateway matches incoming payments to orders by amount, so two users
// paying the same whole amount at the same time can be credited to each
// other's orders. Each epay order therefore pays its base amount plus a random
// 0.01–0.99 surcharge that no other pending order is using. The surcharge is
// credited too (see model.EpayPaySurcharge).
const epayPayMoneyReserveWindow = 30 * time.Minute

var errEpayPayMoneyExhausted = errors.New("no free epay pay amount for this base amount")

var (
	epayPayMoneyMu       sync.Mutex
	epayPayMoneyReserved = map[int64]int64{} // pay amount in cents -> reservation expiry (unix seconds)
)

// allocateEpayPayMoney returns base plus a unique random fraction under one
// yuan. Uniqueness is checked
// against pending epay orders in the database and against reservations made
// by this process and, when Redis is on, by every instance sharing it.
func allocateEpayPayMoney(ctx context.Context, base float64) (float64, error) {
	baseCents := decimal.NewFromFloat(base).Round(2).Shift(2).IntPart()
	now := time.Now()
	used, err := model.GetPendingEpayPayMoneyCents(now.Add(-epayPayMoneyReserveWindow).Unix(), baseCents+1, baseCents+99)
	if err != nil {
		return 0, err
	}

	epayPayMoneyMu.Lock()
	defer epayPayMoneyMu.Unlock()
	for cents, expiry := range epayPayMoneyReserved {
		if expiry <= now.Unix() {
			delete(epayPayMoneyReserved, cents)
		}
	}

	for _, offset := range rand.Perm(99) {
		cents := baseCents + int64(offset) + 1
		if _, ok := used[cents]; ok {
			continue
		}
		if _, ok := epayPayMoneyReserved[cents]; ok {
			continue
		}
		if common.RedisEnabled && common.RDB != nil {
			key := fmt.Sprintf("epay:pay_money:%d", cents)
			acquired, err := common.RDB.SetNX(ctx, key, 1, epayPayMoneyReserveWindow).Result()
			if err != nil {
				return 0, err
			}
			if !acquired {
				continue
			}
		}
		epayPayMoneyReserved[cents] = now.Add(epayPayMoneyReserveWindow).Unix()
		return decimal.NewFromInt(cents).Shift(-2).InexactFloat64(), nil
	}
	return 0, errEpayPayMoneyExhausted
}

// A quote keeps the pay amount a user was shown stable until they pay, so the
// wallet preview and the epay order charge the same amount. It lives shorter
// than the slot reservation above, so a quoted amount is always still reserved.
const epayPayMoneyQuoteTTL = 10 * time.Minute

type epayPayMoneyQuote struct {
	cents  int64
	expiry int64
}

var epayPayMoneyQuotes = map[string]epayPayMoneyQuote{} // guarded by epayPayMoneyMu

func epayPayMoneyQuoteKey(userID int, baseCents int64) string {
	return fmt.Sprintf("epay:pay_quote:%d:%d", userID, baseCents)
}

// quoteEpayPayMoney returns the pay amount reserved for this user and base
// amount, allocating and remembering a new one when there is none.
func quoteEpayPayMoney(ctx context.Context, userID int, base float64) (float64, error) {
	baseCents := decimal.NewFromFloat(base).Round(2).Shift(2).IntPart()
	key := epayPayMoneyQuoteKey(userID, baseCents)
	if cents, ok := lookupEpayPayMoneyQuote(ctx, key); ok {
		return decimal.NewFromInt(cents).Shift(-2).InexactFloat64(), nil
	}
	money, err := allocateEpayPayMoney(ctx, base)
	if err != nil {
		return 0, err
	}
	cents := decimal.NewFromFloat(money).Round(2).Shift(2).IntPart()
	if common.RedisEnabled && common.RDB != nil {
		if err := common.RDB.Set(ctx, key, cents, epayPayMoneyQuoteTTL).Err(); err != nil {
			return 0, err
		}
	} else {
		epayPayMoneyMu.Lock()
		epayPayMoneyQuotes[key] = epayPayMoneyQuote{cents: cents, expiry: time.Now().Add(epayPayMoneyQuoteTTL).Unix()}
		epayPayMoneyMu.Unlock()
	}
	return money, nil
}

func lookupEpayPayMoneyQuote(ctx context.Context, key string) (int64, bool) {
	if common.RedisEnabled && common.RDB != nil {
		cents, err := common.RDB.Get(ctx, key).Int64()
		return cents, err == nil && cents > 0
	}
	epayPayMoneyMu.Lock()
	defer epayPayMoneyMu.Unlock()
	q, ok := epayPayMoneyQuotes[key]
	if !ok || q.expiry <= time.Now().Unix() {
		delete(epayPayMoneyQuotes, key)
		return 0, false
	}
	return q.cents, true
}

// consumeEpayPayMoneyQuote drops the quote once an order uses it; the pending
// order then keeps the amount reserved and the next order gets a fresh one.
func consumeEpayPayMoneyQuote(ctx context.Context, userID int, base float64) {
	key := epayPayMoneyQuoteKey(userID, decimal.NewFromFloat(base).Round(2).Shift(2).IntPart())
	if common.RedisEnabled && common.RDB != nil {
		_ = common.RDB.Del(ctx, key).Err()
		return
	}
	epayPayMoneyMu.Lock()
	delete(epayPayMoneyQuotes, key)
	epayPayMoneyMu.Unlock()
}
